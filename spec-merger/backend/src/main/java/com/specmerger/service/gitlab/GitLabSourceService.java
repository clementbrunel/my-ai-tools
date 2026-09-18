package com.specmerger.service.gitlab;

import com.specmerger.dto.GitLabProjectSummary;
import com.specmerger.dto.GitLabSourceListing;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.gitlab4j.api.GitLabApiException;

/**
 * Abstraction over how JXML démarche sources are browsed and fetched (#266) — decouples
 * {@link com.specmerger.controller.GitLabController} and {@link
 * com.specmerger.service.AnalysisService} from GitLab specifically, same idea as {@link
 * com.specmerger.service.ai.SpecResolutionAIProvider} for mistral-vibe. {@link
 * GitLabApiSourceService} is the real, GitLab-backed implementation; {@link
 * MockGitLabSourceService} (selected instead when {@code gitlab.mock}/{@code GITLAB_MOCK=true})
 * exposes a single fake project backed by a bundled JXML sample, so the pipeline can be
 * exercised without GitLab being reachable at all.
 */
public interface GitLabSourceService {

    /** Lists the projects of every configured group, tagged with the group's key. */
    List<GitLabProjectSummary> listAllProjects() throws GitLabApiException;

    /**
     * Lists the paths of the files a project has that are relevant, without downloading their
     * content — used to let the user review/deselect sources (checkboxes) before they're
     * actually fetched for analysis. Files that FORMS.jxml (the EAR's démarche menu) references
     * as entry points are singled out separately: the user picks exactly one démarche to
     * document, not a free checkbox selection like the rest. Translation resources are also
     * singled out as {@code mandatoryPaths}, since excluding them only leaves {@code trans(...)}
     * keys unresolved (#285) — only includes/Java remain freely checkable.
     */
    GitLabSourceListing listRelevantSourcePaths(String groupKey, String projectIdOrPath) throws GitLabApiException;

    /**
     * Downloads the content of the project's relevant files, keyed by their repository path.
     * When {@code selectedPaths} is non-null, only those among the relevant files (plus {@code
     * entryPointPath}, if given — it's never itself offered as a checkbox) are downloaded; a
     * null {@code selectedPaths} downloads every relevant file. Translation resources are
     * always downloaded regardless of {@code selectedPaths}.
     */
    Map<String, String> fetchRelevantSources(String groupKey, String projectIdOrPath,
            Collection<String> selectedPaths, String entryPointPath) throws GitLabApiException, IOException;

    /**
     * Resolves every source's own {@code trans(...)} calls (configured language, see {@code
     * gitlab.translation-language}) against only its own translation resources (see {@link
     * TranslationResolver#resolveAll}) — exposed so callers other than {@link
     * #previewResolvedJxml} (e.g. the Word/JXML diff pipeline) can apply the same resolution to
     * sources fetched via {@link #fetchRelevantSources}.
     */
    Map<String, String> resolveAllTranslations(Map<String, String> filesByPath);

    /**
     * Fetches the selected sources (forcing the chosen démarche's entry point in, exactly like
     * {@link #fetchRelevantSources}) and resolves each source's own {@code trans(...)} calls
     * before flattening the Include chain into a single document — this is what the user
     * reviews before it's actually sent to the model. Issues worth the user's attention
     * (unresolved Includes, incomplete tag nesting, unresolved translation keys) are reported
     * separately from the content, rather than left for them to spot buried in it. Composed
     * entirely from the abstract methods above, so implementations never need to override it.
     */
    default JxmlPreviewResult previewResolvedJxml(String groupKey, String projectIdOrPath,
            Collection<String> selectedPaths, String entryPointPath) throws GitLabApiException, IOException {
        if (entryPointPath == null || entryPointPath.isBlank()) {
            throw new IllegalArgumentException("entryPointPath est requis pour prévisualiser le JXML résolu.");
        }
        Map<String, String> filesByPath = fetchRelevantSources(groupKey, projectIdOrPath, selectedPaths, entryPointPath);
        Map<String, String> translatedFiles = resolveAllTranslations(filesByPath);
        String resolved = JxmlIncludeResolver.resolve(entryPointPath, translatedFiles);

        List<String> warnings = new ArrayList<>(JxmlIncludeResolver.findWarnings(resolved));
        for (String key : TranslationResolver.findUnresolvedKeys(resolved)) {
            warnings.add("Clé de traduction non résolue : trans(" + key + ")");
        }
        return new JxmlPreviewResult(resolved, warnings);
    }

    record JxmlPreviewResult(String content, List<String> warnings) {
    }
}

package com.specmerger.service.gitlab;

import com.specmerger.config.GitLabProperties;
import com.specmerger.dto.GitLabEntryPoint;
import com.specmerger.dto.GitLabProjectSummary;
import com.specmerger.dto.GitLabSourceListing;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.gitlab4j.api.GitLabApi;
import org.gitlab4j.api.GitLabApiException;
import org.gitlab4j.api.models.Project;
import org.gitlab4j.api.models.TreeItem;
import org.springframework.stereotype.Service;

/**
 * Browses the configured GitLab groups of JWAY projects (see #266) and downloads
 * only the files worth sending to the model, replacing the manual zip/paste upload
 * flow. Each group has its own translation/Java filter patterns (see
 * {@link GitLabProperties.Group}).
 */
@Slf4j
@Service
public class GitLabSourceService {

    private final GitLabApiFactory apiFactory;
    private final GitLabProperties properties;

    public GitLabSourceService(GitLabApiFactory apiFactory, GitLabProperties properties) {
        this.apiFactory = apiFactory;
        this.properties = properties;
    }

    @PostConstruct
    void logConfiguration() {
        log.info("GitLab config : url='{}', token={}", properties.url(), maskedToken());
        if (properties.groups().isEmpty()) {
            log.warn("GitLab config : gitlab.groups est vide, aucun groupe GitLab ne sera interrogé.");
            return;
        }
        for (GitLabProperties.Group group : properties.groups()) {
            boolean enabled = group.path() != null && !group.path().isBlank();
            log.info("GitLab config : groupe key='{}' path='{}' ({}), translationPatterns='{}', javaPatterns='{}'",
                    group.key(), group.path(), enabled ? "activé" : "désactivé, path vide",
                    group.translationPatterns(), group.javaPatterns());
        }
    }

    /** Lists the projects of every configured group, tagged with the group's key. */
    public List<GitLabProjectSummary> listAllProjects() throws GitLabApiException {
        try (GitLabApi api = apiFactory.create()) {
            List<GitLabProjectSummary> summaries = new ArrayList<>();
            for (GitLabProperties.Group group : properties.groups()) {
                if (group.path() == null || group.path().isBlank()) {
                    continue;
                }
                Object identifier = resolveIdentifier(group.path());
                log.debug("GitLab: listing des projets du groupe '{}' (identifiant résolu='{}')",
                        group.key(), identifier);
                List<Project> projects;
                try {
                    projects = api.getGroupApi().getProjects(identifier);
                } catch (GitLabApiException e) {
                    log.error("GitLab: échec du listing des projets pour le groupe '{}' (GITLAB_GROUP path='{}', "
                                    + "identifiant résolu='{}') : HTTP {} {} — {}",
                            group.key(), group.path(), identifier, e.getHttpStatus(), e.getReason(), e.getMessage());
                    throw e;
                }
                log.info("GitLab: {} projet(s) trouvé(s) pour le groupe '{}'", projects.size(), group.key());
                for (Project p : projects) {
                    summaries.add(new GitLabProjectSummary(
                            p.getId(), p.getName(), p.getPathWithNamespace(), p.getDefaultBranch(), p.getWebUrl(),
                            group.key()));
                }
            }
            summaries.sort(Comparator.comparing(GitLabProjectSummary::groupKey, String.CASE_INSENSITIVE_ORDER)
                    .thenComparing(GitLabProjectSummary::name, String.CASE_INSENSITIVE_ORDER));
            return summaries;
        }
    }

    /**
     * Lists the paths of the files a project has that {@link SourceFileFilter} deems
     * relevant, without downloading their content — used to let the user review/deselect
     * sources (checkboxes) before they're actually fetched for analysis. Files that FORMS.jxml
     * (the EAR's démarche menu) references as entry points are singled out separately: the
     * user picks exactly one démarche to document, not a free checkbox selection like the
     * rest. Translation resources ({@link TranslationResolver#isTranslationFile}) are also
     * singled out as {@code mandatoryPaths}, since excluding them only leaves {@code
     * trans(...)} keys unresolved (#285) — only includes/Java remain freely checkable.
     */
    public GitLabSourceListing listRelevantSourcePaths(String groupKey, String projectIdOrPath) throws GitLabApiException {
        try (GitLabApi api = apiFactory.create()) {
            ResolvedTree resolved = resolveTree(api, groupKey, projectIdOrPath);
            List<String> allPaths = resolved.tree().stream()
                    .filter(item -> item.getType() == TreeItem.Type.BLOB && resolved.filter().isRelevant(item.getPath()))
                    .map(TreeItem::getPath)
                    .sorted()
                    .toList();

            List<GitLabEntryPoint> entryPoints = resolveEntryPoints(api, resolved, allPaths);
            Set<String> entryPointPaths = entryPoints.stream().map(GitLabEntryPoint::path).collect(Collectors.toSet());
            List<String> remainingPaths = allPaths.stream().filter(p -> !entryPointPaths.contains(p)).toList();
            List<String> mandatoryPaths = remainingPaths.stream().filter(TranslationResolver::isTranslationFile).toList();
            List<String> optionalPaths = remainingPaths.stream()
                    .filter(p -> !TranslationResolver.isTranslationFile(p))
                    .toList();

            log.info("GitLab: {} fichier(s) pertinent(s) sur {} ({}), dont {} point(s) d'entrée FORMS.jxml et "
                            + "{} fichier(s) de traduction obligatoire(s)",
                    allPaths.size(), resolved.project().getPathWithNamespace(), groupKey, entryPoints.size(),
                    mandatoryPaths.size());
            return new GitLabSourceListing(entryPoints, mandatoryPaths, optionalPaths);
        }
    }

    /**
     * Locates FORMS.jxml among the project's relevant files (there may be none — not every
     * GitLab project browsed here is an EAR with a démarche menu) and resolves each
     * {@code <Hyperlink Type="Document" DocumentId="...">} it declares to the matching file
     * path, so the caller can offer them as a single-select list instead of free checkboxes.
     * Never fails the whole listing: a missing FORMS.jxml, an unparseable one, or a
     * DocumentId with no matching file just yields fewer (or zero) entry points.
     */
    private List<GitLabEntryPoint> resolveEntryPoints(GitLabApi api, ResolvedTree resolved, List<String> allPaths) {
        String formsPath = allPaths.stream()
                .filter(p -> fileNameWithoutExtension(p).equalsIgnoreCase("FORMS"))
                .findFirst()
                .orElse(null);
        if (formsPath == null) {
            return List.of();
        }

        String formsContent;
        try (InputStream raw = api.getRepositoryFileApi().getRawFile(resolved.projectId(), resolved.ref(), formsPath)) {
            formsContent = new String(raw.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException | GitLabApiException e) {
            log.warn("GitLab: impossible de lire '{}' pour résoudre les points d'entrée de '{}' : {}",
                    formsPath, resolved.project().getPathWithNamespace(), e.getMessage());
            return List.of();
        }

        List<GitLabEntryPoint> entryPoints = new ArrayList<>();
        for (String documentId : FormsEntryPointParser.extractDocumentIds(formsContent)) {
            allPaths.stream()
                    .filter(p -> fileNameWithoutExtension(p).equals(documentId))
                    .findFirst()
                    .ifPresentOrElse(
                            path -> entryPoints.add(new GitLabEntryPoint(documentId, path)),
                            () -> log.warn("GitLab: point d'entrée '{}' référencé par '{}' introuvable parmi les "
                                    + "fichiers de '{}'", documentId, formsPath, resolved.project().getPathWithNamespace()));
        }
        return entryPoints;
    }

    private static String fileNameWithoutExtension(String path) {
        String name = path.substring(path.lastIndexOf('/') + 1);
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }

    /**
     * Downloads the content of the project's relevant files, keyed by their repository
     * path. When {@code selectedPaths} is non-null, only those among the relevant files
     * (plus {@code entryPointPath}, if given — see {@link #listRelevantSourcePaths}, it's
     * never itself offered as a checkbox) are downloaded; a null {@code selectedPaths}
     * downloads every relevant file. Translation resources ({@link
     * TranslationResolver#isTranslationFile}) are always downloaded regardless of {@code
     * selectedPaths} — they're never offered as a checkbox in the first place (see
     * {@link #listRelevantSourcePaths}'s {@code mandatoryPaths}), so a selection that omits
     * them (e.g. a stale client) must not silently drop them either.
     */
    public Map<String, String> fetchRelevantSources(String groupKey, String projectIdOrPath,
            Collection<String> selectedPaths, String entryPointPath) throws GitLabApiException, IOException {
        Collection<String> effectivePaths = withEntryPoint(selectedPaths, entryPointPath);
        try (GitLabApi api = apiFactory.create()) {
            ResolvedTree resolved = resolveTree(api, groupKey, projectIdOrPath);
            Map<String, String> filesByPath = new LinkedHashMap<>();
            for (TreeItem item : resolved.tree()) {
                if (item.getType() != TreeItem.Type.BLOB || !resolved.filter().isRelevant(item.getPath())) {
                    continue;
                }
                boolean isMandatoryTranslation = TranslationResolver.isTranslationFile(item.getPath());
                if (effectivePaths != null && !effectivePaths.contains(item.getPath()) && !isMandatoryTranslation) {
                    continue;
                }
                try (InputStream raw = api.getRepositoryFileApi().getRawFile(resolved.projectId(), resolved.ref(), item.getPath())) {
                    filesByPath.put(item.getPath(), new String(raw.readAllBytes(), StandardCharsets.UTF_8));
                } catch (GitLabApiException e) {
                    log.error("GitLab: échec du téléchargement de '{}' dans '{}' (branche='{}') : HTTP {} {} — {}",
                            item.getPath(), resolved.project().getPathWithNamespace(), resolved.ref(),
                            e.getHttpStatus(), e.getReason(), e.getMessage());
                    throw e;
                }
            }
            log.info("GitLab: {} fichier(s) retenu(s) sur {} ({}) après filtrage{}",
                    filesByPath.size(), resolved.project().getPathWithNamespace(), groupKey,
                    effectivePaths != null ? " et sélection utilisateur" : "");
            return filesByPath;
        }
    }

    /**
     * Fetches the selected sources (forcing the chosen démarche's entry point in, exactly
     * like {@link #fetchRelevantSources}) and resolves each source's own {@code trans(...)}
     * calls against only its own translation resources (see {@link TranslationResolver#resolveAll},
     * #285) before flattening the Include chain into a single document — this is what the user
     * reviews before it's actually sent to the model. Issues worth the user's attention
     * (unresolved Includes, incomplete tag nesting, unresolved translation keys) are reported
     * separately from the content, rather than left for them to spot buried in it.
     */
    public JxmlPreviewResult previewResolvedJxml(String groupKey, String projectIdOrPath,
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

    /** Resolves every source's own {@code trans(...)} calls (configured language, see
     * {@code gitlab.translation-language}) against only its own translation resources (see
     * {@link TranslationResolver#resolveAll}) — exposed so callers other than
     * {@link #previewResolvedJxml} (e.g. the Word/JXML diff pipeline) can apply the same
     * resolution to sources fetched via {@link #fetchRelevantSources}. */
    public Map<String, String> resolveAllTranslations(Map<String, String> filesByPath) {
        return TranslationResolver.resolveAll(filesByPath, properties.translationLanguage());
    }

    public record JxmlPreviewResult(String content, List<String> warnings) {
    }

    private static Collection<String> withEntryPoint(Collection<String> selectedPaths, String entryPointPath) {
        if (selectedPaths == null || entryPointPath == null || entryPointPath.isBlank()) {
            return selectedPaths;
        }
        Set<String> merged = new LinkedHashSet<>(selectedPaths);
        merged.add(entryPointPath);
        return merged;
    }

    private record ResolvedTree(Object projectId, Project project, String ref, List<TreeItem> tree, SourceFileFilter filter) {
    }

    private ResolvedTree resolveTree(GitLabApi api, String groupKey, String projectIdOrPath) throws GitLabApiException {
        SourceFileFilter filter = filterFor(groupKey);
        Object projectId = resolveIdentifier(projectIdOrPath);
        log.debug("GitLab: résolution du projet '{}' (groupe='{}', identifiant résolu='{}')",
                projectIdOrPath, groupKey, projectId);
        Project project;
        try {
            project = api.getProjectApi().getProject(projectId);
        } catch (GitLabApiException e) {
            log.error("GitLab: échec de la résolution du projet '{}' (groupe='{}', identifiant résolu='{}') : "
                            + "HTTP {} {} — {}",
                    projectIdOrPath, groupKey, projectId, e.getHttpStatus(), e.getReason(), e.getMessage());
            throw e;
        }
        String ref = project.getDefaultBranch();
        log.debug("GitLab: projet '{}' résolu (branche par défaut='{}')", project.getPathWithNamespace(), ref);

        List<TreeItem> tree;
        try {
            tree = api.getRepositoryApi().getTree(projectId, "", ref, true);
        } catch (GitLabApiException e) {
            log.error("GitLab: échec de la lecture de l'arborescence du projet '{}' (branche='{}') : "
                            + "HTTP {} {} — {}",
                    project.getPathWithNamespace(), ref, e.getHttpStatus(), e.getReason(), e.getMessage());
            throw e;
        }
        log.debug("GitLab: {} entrée(s) dans l'arborescence de '{}'", tree.size(), project.getPathWithNamespace());

        return new ResolvedTree(projectId, project, ref, tree, filter);
    }

    private SourceFileFilter filterFor(String groupKey) {
        GitLabProperties.Group group = properties.groups().stream()
                .filter(g -> g.key() != null && g.key().equals(groupKey))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Groupe GitLab inconnu : " + groupKey));
        return new SourceFileFilter(group.translationPatterns(), group.javaPatterns());
    }

    private Object resolveIdentifier(String idOrPath) {
        String trimmed = idOrPath.trim();
        try {
            return Long.parseLong(trimmed);
        } catch (NumberFormatException e) {
            return trimmed;
        }
    }

    private String maskedToken() {
        String token = properties.token();
        if (token == null || token.isBlank()) {
            return "(absent)";
        }
        int visible = Math.min(3, token.length());
        return "?".repeat(token.length() - visible) + token.substring(token.length() - visible);
    }
}

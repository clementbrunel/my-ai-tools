package com.specmerger.service.gitlab;

import com.specmerger.dto.GitLabEntryPoint;
import com.specmerger.dto.GitLabProjectSummary;
import com.specmerger.dto.GitLabSourceListing;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

/**
 * Stand-in for {@link GitLabApiSourceService} when GitLab isn't reachable (e.g. working from
 * outside the office network) — see {@code gitlab.mock} in application.yml. Exposes a single
 * fake project backed by a bundled JXML sample instead of ever calling GitLab, same idea as
 * {@link com.specmerger.service.ai.MockSpecResolutionAIProvider} for mistral-vibe. Picking this
 * project from the UI exercises the rest of the pipeline (source listing, preview, génération)
 * exactly like a real one, since both implement the same {@link GitLabSourceService}.
 */
@Slf4j
@Service
@ConditionalOnProperty(prefix = "gitlab", name = "mock", havingValue = "true")
public class MockGitLabSourceService implements GitLabSourceService {

    private static final String GROUP_KEY = "mock";
    private static final String ENTRY_POINT_PATH = "sample-demarche.jxml";
    private static final String DOCUMENT_ID = "sample-demarche";
    private static final GitLabProjectSummary PROJECT = new GitLabProjectSummary(
            0L, "🧪 Démarche d'exemple (mock, sans GitLab)", "mock/sample-demarche", "main", "", GROUP_KEY);
    private static final String JXML_CONTENT = loadJxml();

    public MockGitLabSourceService() {
        log.warn("gitlab.mock=true — GitLabSourceService is mocked, no call will reach GitLab");
    }

    @Override
    public List<GitLabProjectSummary> listAllProjects() {
        return List.of(PROJECT);
    }

    @Override
    public GitLabSourceListing listRelevantSourcePaths(String groupKey, String projectIdOrPath) {
        return new GitLabSourceListing(List.of(new GitLabEntryPoint(DOCUMENT_ID, ENTRY_POINT_PATH)), List.of(), List.of());
    }

    @Override
    public Map<String, String> fetchRelevantSources(String groupKey, String projectIdOrPath,
            Collection<String> selectedPaths, String entryPointPath) {
        return Map.of(ENTRY_POINT_PATH, JXML_CONTENT);
    }

    @Override
    public Map<String, String> resolveAllTranslations(Map<String, String> filesByPath) {
        // The sample JXML has no trans(...) calls and no translation file rides along with it —
        // nothing to resolve.
        return filesByPath;
    }

    private static String loadJxml() {
        try (InputStream is = new ClassPathResource("samples/sample-demarche.jxml").getInputStream()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Impossible de charger samples/sample-demarche.jxml", e);
        }
    }
}

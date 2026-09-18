package com.specmerger.service.gitlab;

import com.specmerger.config.GitLabProperties;
import com.specmerger.dto.GitLabEntryPoint;
import com.specmerger.dto.GitLabProjectSummary;
import com.specmerger.dto.GitLabSourceListing;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.gitlab4j.api.GitLabApi;
import org.gitlab4j.api.GitLabApiException;
import org.gitlab4j.api.models.Project;
import org.gitlab4j.api.models.TreeItem;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

/**
 * Browses the configured GitLab groups of JWAY projects (see #266) and downloads
 * only the files worth sending to the model, replacing the manual zip/paste upload
 * flow. Each group has its own translation/Java filter patterns (see
 * {@link GitLabProperties.Group}).
 */
@Slf4j
@Service
@ConditionalOnProperty(prefix = "gitlab", name = "mock", havingValue = "false", matchIfMissing = true)
public class GitLabApiSourceService implements GitLabSourceService {

    private static final Duration PROJECTS_CACHE_TTL = Duration.ofHours(1);

    private final GitLabApiFactory apiFactory;
    private final GitLabProperties properties;

    /** Cached result of {@link #fetchAllProjects()} — see {@link #listAllProjects()}. */
    private volatile List<GitLabProjectSummary> cachedProjects;
    private volatile Instant cachedProjectsAt;

    public GitLabApiSourceService(GitLabApiFactory apiFactory, GitLabProperties properties) {
        this.apiFactory = apiFactory;
        this.properties = properties;
    }

    /**
     * Pre-warms the projects cache as soon as the app is up, in the background, so the
     * frontend's first "load projects" call already finds a warm cache instead of waiting
     * on GitLab (see #listAllProjects()).
     */
    @EventListener(ApplicationReadyEvent.class)
    void warmProjectsCacheOnStartup() {
        CompletableFuture.runAsync(() -> {
            try {
                refreshProjectsCache();
            } catch (GitLabApiException e) {
                log.warn("GitLab: échec du préchargement des projets au démarrage, "
                        + "il sera retenté au premier appel : {}", e.getMessage());
            }
        });
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

    /**
     * Lists the projects of every configured group, tagged with the group's key. Served from
     * a cache refreshed at most once an hour ({@link #PROJECTS_CACHE_TTL}) — GitLab's group
     * listing barely changes minute to minute, and re-fetching it on every frontend load made
     * the app feel slow for no benefit. The cache is pre-warmed at startup (see
     * {@link #warmProjectsCacheOnStartup()}); this method only re-fetches when it's missing or
     * stale.
     */
    @Override
    public List<GitLabProjectSummary> listAllProjects() throws GitLabApiException {
        List<GitLabProjectSummary> cached = cachedProjects;
        if (cached != null && Instant.now().isBefore(cachedProjectsAt.plus(PROJECTS_CACHE_TTL))) {
            return cached;
        }
        return refreshProjectsCache();
    }

    private synchronized List<GitLabProjectSummary> refreshProjectsCache() throws GitLabApiException {
        List<GitLabProjectSummary> cached = cachedProjects;
        if (cached != null && Instant.now().isBefore(cachedProjectsAt.plus(PROJECTS_CACHE_TTL))) {
            return cached;
        }
        List<GitLabProjectSummary> fetched = fetchAllProjects();
        cachedProjects = fetched;
        cachedProjectsAt = Instant.now();
        return fetched;
    }

    private List<GitLabProjectSummary> fetchAllProjects() throws GitLabApiException {
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

    @Override
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

    @Override
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

    @Override
    public Map<String, String> resolveAllTranslations(Map<String, String> filesByPath) {
        return TranslationResolver.resolveAll(filesByPath, properties.translationLanguage());
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

package com.specmerger.service;

import com.specmerger.entity.DocumentRevision;
import com.specmerger.entity.GeneratedDocument;
import com.specmerger.entity.GeneratedDocument.Source;
import com.specmerger.repository.DocumentRevisionRepository;
import com.specmerger.repository.GeneratedDocumentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GeneratedDocumentServiceTest {

    @Mock
    private GeneratedDocumentRepository documentRepository;
    @Mock
    private DocumentRevisionRepository revisionRepository;

    private GeneratedDocumentService newService() {
        return new GeneratedDocumentService(documentRepository, revisionRepository);
    }

    @Test
    void createWordPersistsTheDocumentAndItsFirstRevision() {
        GeneratedDocumentService service = newService();
        when(documentRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(documentRepository.lockById(any())).thenAnswer(invocation -> Optional.of(new GeneratedDocument()));
        when(revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(any())).thenReturn(Optional.empty());

        GeneratedDocument document = service.createWord("# Doc Word");

        assertThat(document.getSource()).isEqualTo(Source.WORD);
        assertThat(document.getWordDocumentId()).isNull();
        assertThat(document.getJxmlDocumentId()).isNull();

        ArgumentCaptor<DocumentRevision> revisionCaptor = ArgumentCaptor.forClass(DocumentRevision.class);
        verify(revisionRepository).save(revisionCaptor.capture());
        assertThat(revisionCaptor.getValue().getRevisionNumber()).isEqualTo(1);
        assertThat(revisionCaptor.getValue().getContent()).isEqualTo("# Doc Word");
        assertThat(revisionCaptor.getValue().getDocumentId()).isEqualTo(document.getId());
    }

    @Test
    void createMergedLinksTheTwoSourceDocumentIdsAndTheGitlabSelection() {
        GeneratedDocumentService service = newService();
        when(documentRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(documentRepository.lockById(any())).thenAnswer(invocation -> Optional.of(new GeneratedDocument()));
        when(revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(any())).thenReturn(Optional.empty());
        UUID wordId = UUID.randomUUID();
        UUID jxmlId = UUID.randomUUID();

        GeneratedDocument document = service.createMerged("# Fusionné", wordId, jxmlId, "{\"projectId\":\"1\"}");

        assertThat(document.getSource()).isEqualTo(Source.MERGED);
        assertThat(document.getWordDocumentId()).isEqualTo(wordId);
        assertThat(document.getJxmlDocumentId()).isEqualTo(jxmlId);
        assertThat(document.getGitlabSelectionJson()).isEqualTo("{\"projectId\":\"1\"}");
    }

    @Test
    void getLatestContentReturnsTheHighestRevisionNumberContent() {
        GeneratedDocumentService service = newService();
        UUID documentId = UUID.randomUUID();
        DocumentRevision latest = new DocumentRevision();
        latest.setContent("# v3");
        when(revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(documentId)).thenReturn(Optional.of(latest));

        assertThat(service.getLatestContent(documentId)).isEqualTo("# v3");
    }

    @Test
    void getLatestContentThrowsForAnUnknownDocument() {
        GeneratedDocumentService service = newService();
        UUID documentId = UUID.randomUUID();
        when(revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(documentId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getLatestContent(documentId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(documentId.toString());
    }

    @Test
    void addRevisionAppendsRatherThanOverwritingTheExistingRevision() {
        GeneratedDocumentService service = newService();
        UUID documentId = UUID.randomUUID();
        when(documentRepository.lockById(documentId)).thenReturn(Optional.of(new GeneratedDocument()));
        DocumentRevision existing = new DocumentRevision();
        existing.setRevisionNumber(1);
        when(revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(documentId)).thenReturn(Optional.of(existing));

        service.addRevision(documentId, "# v2 édité à la main");

        ArgumentCaptor<DocumentRevision> revisionCaptor = ArgumentCaptor.forClass(DocumentRevision.class);
        verify(revisionRepository).save(revisionCaptor.capture());
        assertThat(revisionCaptor.getValue().getRevisionNumber()).isEqualTo(2);
        assertThat(revisionCaptor.getValue().getContent()).isEqualTo("# v2 édité à la main");
    }

    @Test
    void addRevisionThrowsForAnUnknownDocumentWithoutSavingAnything() {
        GeneratedDocumentService service = newService();
        UUID documentId = UUID.randomUUID();
        when(documentRepository.lockById(documentId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.addRevision(documentId, "content"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(documentId.toString());
        verify(revisionRepository, never()).save(any());
    }

    @Test
    void getSessionReturnsTheMergeAndBothSourceDocumentsAndTheGitlabSelection() {
        GeneratedDocumentService service = newService();
        UUID wordId = UUID.randomUUID();
        UUID jxmlId = UUID.randomUUID();
        UUID mergedId = UUID.randomUUID();

        GeneratedDocument merged = new GeneratedDocument();
        merged.setId(mergedId);
        merged.setSource(Source.MERGED);
        merged.setWordDocumentId(wordId);
        merged.setJxmlDocumentId(jxmlId);
        merged.setGitlabSelectionJson("{\"projectId\":\"1\"}");
        when(documentRepository.findById(mergedId)).thenReturn(Optional.of(merged));

        DocumentRevision mergedRevision = new DocumentRevision();
        mergedRevision.setContent("# Fusionné");
        DocumentRevision wordRevision = new DocumentRevision();
        wordRevision.setContent("# Word");
        DocumentRevision jxmlRevision = new DocumentRevision();
        jxmlRevision.setContent("# JXML");
        when(revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(mergedId))
                .thenReturn(Optional.of(mergedRevision));
        when(revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(wordId))
                .thenReturn(Optional.of(wordRevision));
        when(revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(jxmlId))
                .thenReturn(Optional.of(jxmlRevision));

        var session = service.getSession(mergedId);

        assertThat(session.mergedDocumentId()).isEqualTo(mergedId);
        assertThat(session.mergedMarkdown()).isEqualTo("# Fusionné");
        assertThat(session.wordDocumentId()).isEqualTo(wordId);
        assertThat(session.wordMarkdown()).isEqualTo("# Word");
        assertThat(session.jxmlDocumentId()).isEqualTo(jxmlId);
        assertThat(session.jxmlMarkdown()).isEqualTo("# JXML");
        assertThat(session.gitlabSelectionJson()).isEqualTo("{\"projectId\":\"1\"}");
    }

    @Test
    void getSessionReturnsOnlyTheWordSlotForALoneWordDocument() {
        GeneratedDocumentService service = newService();
        UUID wordId = UUID.randomUUID();
        GeneratedDocument word = new GeneratedDocument();
        word.setId(wordId);
        word.setSource(Source.WORD);
        when(documentRepository.findById(wordId)).thenReturn(Optional.of(word));
        DocumentRevision wordRevision = new DocumentRevision();
        wordRevision.setContent("# Word");
        when(revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(wordId))
                .thenReturn(Optional.of(wordRevision));

        var session = service.getSession(wordId);

        assertThat(session.wordDocumentId()).isEqualTo(wordId);
        assertThat(session.wordMarkdown()).isEqualTo("# Word");
        assertThat(session.mergedDocumentId()).isNull();
        assertThat(session.mergedMarkdown()).isNull();
        assertThat(session.jxmlDocumentId()).isNull();
        assertThat(session.jxmlMarkdown()).isNull();
        assertThat(session.gitlabSelectionJson()).isNull();
    }

    @Test
    void getSessionReturnsOnlyTheJxmlSlotForALoneJxmlDocument() {
        GeneratedDocumentService service = newService();
        UUID jxmlId = UUID.randomUUID();
        GeneratedDocument jxml = new GeneratedDocument();
        jxml.setId(jxmlId);
        jxml.setSource(Source.JXML);
        when(documentRepository.findById(jxmlId)).thenReturn(Optional.of(jxml));
        DocumentRevision jxmlRevision = new DocumentRevision();
        jxmlRevision.setContent("# JXML");
        when(revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(jxmlId))
                .thenReturn(Optional.of(jxmlRevision));

        var session = service.getSession(jxmlId);

        assertThat(session.jxmlDocumentId()).isEqualTo(jxmlId);
        assertThat(session.jxmlMarkdown()).isEqualTo("# JXML");
        assertThat(session.mergedDocumentId()).isNull();
        assertThat(session.mergedMarkdown()).isNull();
        assertThat(session.wordDocumentId()).isNull();
        assertThat(session.wordMarkdown()).isNull();
    }

    @Test
    void getSessionThrowsForAnUnknownDocument() {
        GeneratedDocumentService service = newService();
        UUID documentId = UUID.randomUUID();
        when(documentRepository.findById(documentId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getSession(documentId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(documentId.toString());
    }
}

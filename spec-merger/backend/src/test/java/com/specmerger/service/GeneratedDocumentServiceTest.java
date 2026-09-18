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
    void createMergedLinksTheTwoSourceDocumentIds() {
        GeneratedDocumentService service = newService();
        when(documentRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(any())).thenReturn(Optional.empty());
        UUID wordId = UUID.randomUUID();
        UUID jxmlId = UUID.randomUUID();

        GeneratedDocument document = service.createMerged("# Fusionné", wordId, jxmlId);

        assertThat(document.getSource()).isEqualTo(Source.MERGED);
        assertThat(document.getWordDocumentId()).isEqualTo(wordId);
        assertThat(document.getJxmlDocumentId()).isEqualTo(jxmlId);
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
        when(documentRepository.existsById(documentId)).thenReturn(true);
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
        when(documentRepository.existsById(documentId)).thenReturn(false);

        assertThatThrownBy(() -> service.addRevision(documentId, "content"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(documentId.toString());
        verify(revisionRepository, never()).save(any());
    }
}

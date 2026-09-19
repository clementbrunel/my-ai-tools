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

        ArgumentCaptor<DocumentRevision> revisionCaptor = ArgumentCaptor.forClass(DocumentRevision.class);
        verify(revisionRepository).save(revisionCaptor.capture());
        assertThat(revisionCaptor.getValue().getRevisionNumber()).isEqualTo(1);
        assertThat(revisionCaptor.getValue().getContent()).isEqualTo("# Doc Word");
        assertThat(revisionCaptor.getValue().getDocumentId()).isEqualTo(document.getId());
    }

    @Test
    void createJxmlPersistsTheDocumentAndItsFirstRevision() {
        GeneratedDocumentService service = newService();
        when(documentRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(documentRepository.lockById(any())).thenAnswer(invocation -> Optional.of(new GeneratedDocument()));
        when(revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(any())).thenReturn(Optional.empty());

        GeneratedDocument document = service.createJxml("# Doc JXML");

        assertThat(document.getSource()).isEqualTo(Source.JXML);
        ArgumentCaptor<DocumentRevision> revisionCaptor = ArgumentCaptor.forClass(DocumentRevision.class);
        verify(revisionRepository).save(revisionCaptor.capture());
        assertThat(revisionCaptor.getValue().getContent()).isEqualTo("# Doc JXML");
    }

    @Test
    void createMergedPersistsTheDocumentAndItsFirstRevision() {
        GeneratedDocumentService service = newService();
        when(documentRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(documentRepository.lockById(any())).thenAnswer(invocation -> Optional.of(new GeneratedDocument()));
        when(revisionRepository.findTopByDocumentIdOrderByRevisionNumberDesc(any())).thenReturn(Optional.empty());

        GeneratedDocument document = service.createMerged("# Fusionné");

        assertThat(document.getSource()).isEqualTo(Source.MERGED);

        ArgumentCaptor<DocumentRevision> revisionCaptor = ArgumentCaptor.forClass(DocumentRevision.class);
        verify(revisionRepository).save(revisionCaptor.capture());
        assertThat(revisionCaptor.getValue().getContent()).isEqualTo("# Fusionné");
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
}

package com.specmerger.repository;

import com.specmerger.entity.DocumentRevision;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface DocumentRevisionRepository extends JpaRepository<DocumentRevision, UUID> {

    Optional<DocumentRevision> findTopByDocumentIdOrderByRevisionNumberDesc(UUID documentId);
}

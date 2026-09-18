package com.specmerger.repository;

import com.specmerger.entity.DocumentVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentVersionRepository extends JpaRepository<DocumentVersion, UUID> {

    Optional<DocumentVersion> findTopBySessionIdOrderByVersionNumberDesc(UUID sessionId);

    List<DocumentVersion> findBySessionIdOrderByVersionNumberDesc(UUID sessionId);
}

package com.specmerger.repository;

import com.specmerger.entity.Divergence;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DivergenceRepository extends JpaRepository<Divergence, UUID> {

    List<Divergence> findBySessionId(UUID sessionId);
}

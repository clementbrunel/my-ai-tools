package com.specmerger.repository;

import com.specmerger.entity.AnalysisSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AnalysisSessionRepository extends JpaRepository<AnalysisSession, UUID> {
}

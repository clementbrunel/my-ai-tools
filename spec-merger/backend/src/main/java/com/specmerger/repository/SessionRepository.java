package com.specmerger.repository;

import com.specmerger.entity.Session;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SessionRepository extends JpaRepository<Session, UUID> {
}

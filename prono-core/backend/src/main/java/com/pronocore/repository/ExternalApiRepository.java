package com.pronocore.repository;

import com.pronocore.entity.ExternalApi;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExternalApiRepository extends JpaRepository<ExternalApi, Long> {
    Optional<ExternalApi> findByCode(String code);
    List<ExternalApi> findBySportCode(String sportCode);
}

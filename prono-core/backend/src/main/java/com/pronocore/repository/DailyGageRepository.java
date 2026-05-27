package com.pronocore.repository;

import com.pronocore.entity.DailyGage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DailyGageRepository extends JpaRepository<DailyGage, Long> {

    Optional<DailyGage> findByMatchDate(LocalDate date);

    List<DailyGage> findAllByOrderByMatchDateDesc();
}

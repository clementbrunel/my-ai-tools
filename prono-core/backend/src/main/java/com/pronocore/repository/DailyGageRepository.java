package com.pronocore.repository;

import com.pronocore.entity.DailyGage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DailyGageRepository extends JpaRepository<DailyGage, Long> {

    /** All groups' gages for a given day (used by auto-settlement). */
    List<DailyGage> findByMatchDate(LocalDate date);

    Optional<DailyGage> findByGroupIdAndMatchDate(Long groupId, LocalDate date);

    /** The given groups' gages for a day (caller's groups). */
    List<DailyGage> findByMatchDateAndGroupIdIn(LocalDate date, List<Long> groupIds);

    List<DailyGage> findByGroupIdInOrderByMatchDateDesc(List<Long> groupIds);
}

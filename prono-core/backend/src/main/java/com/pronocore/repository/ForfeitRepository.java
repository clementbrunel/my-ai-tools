package com.pronocore.repository;

import com.pronocore.entity.Forfeit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ForfeitRepository extends JpaRepository<Forfeit, Long> {

    List<Forfeit> findByActiveTrue();

    List<Forfeit> findByCategory(String category);
}

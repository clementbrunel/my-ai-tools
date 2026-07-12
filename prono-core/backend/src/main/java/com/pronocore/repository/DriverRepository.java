package com.pronocore.repository;

import com.pronocore.entity.Driver;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DriverRepository extends JpaRepository<Driver, Long> {

    Optional<Driver> findByCode(String code);

    Optional<Driver> findByName(String name);

    @Query("SELECT d FROM Driver d JOIN FETCH d.constructor WHERE d.isActive = true ORDER BY d.constructor.id, d.number")
    List<Driver> findAllActiveWithConstructor();
}

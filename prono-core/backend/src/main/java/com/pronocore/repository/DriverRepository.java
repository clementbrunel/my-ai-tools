package com.pronocore.repository;

import com.pronocore.entity.Driver;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DriverRepository extends JpaRepository<Driver, Long> {

    @Query("SELECT d FROM Driver d JOIN FETCH d.constructor WHERE d.isActive = true ORDER BY d.constructor.id, d.number")
    List<Driver> findAllActiveWithConstructor();
}

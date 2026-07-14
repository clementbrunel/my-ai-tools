package com.pronocore.repository;

import com.pronocore.entity.Newsletter;
import com.pronocore.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NewsletterRepository extends JpaRepository<Newsletter, Long> {

    List<Newsletter> findAllByOrderByCreatedAtDesc();

    /** Recipients of a broadcast: verified accounts that haven't opted out. */
    @Query("SELECT u FROM User u WHERE u.emailVerified = true AND u.emailNewsletterEnabled = true")
    List<User> findNewsletterRecipients();
}

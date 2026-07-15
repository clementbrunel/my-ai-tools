package com.pronocore.repository;

import com.pronocore.entity.Newsletter;
import com.pronocore.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface NewsletterRepository extends JpaRepository<Newsletter, Long> {

    List<Newsletter> findAllByOrderByCreatedAtDesc();

    /** Recipients of a broadcast: verified accounts that haven't opted out. */
    @Query("SELECT u FROM User u WHERE u.emailVerified = true AND u.emailNewsletterEnabled = true")
    List<User> findNewsletterRecipients();

    /**
     * Atomically flips a campaign to SENT, guarded by {@code status = DRAFT}.
     * Two concurrent broadcasts of the same campaign race on this UPDATE; only
     * one can match a row, so the loser (0 rows updated) knows it lost the race
     * instead of both re-blasting every recipient.
     */
    @Modifying
    @Query("UPDATE Newsletter n SET n.status = com.pronocore.entity.Newsletter.Status.SENT, " +
            "n.sentAt = :sentAt, n.sentCount = :sentCount WHERE n.id = :id AND n.status = com.pronocore.entity.Newsletter.Status.DRAFT")
    int markAsSent(@Param("id") Long id, @Param("sentAt") LocalDateTime sentAt, @Param("sentCount") int sentCount);
}

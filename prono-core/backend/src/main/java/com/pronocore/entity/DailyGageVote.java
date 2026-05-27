package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;

/** A +1 or -1 vote by a player on a daily gage candidate. */
@Entity
@Table(name = "daily_gage_votes",
       uniqueConstraints = @UniqueConstraint(columnNames = {"candidate_id", "user_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailyGageVote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", nullable = false)
    private DailyGageCandidate candidate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** +1 (pour) or -1 (contre). */
    @Column(nullable = false)
    private int vote;
}

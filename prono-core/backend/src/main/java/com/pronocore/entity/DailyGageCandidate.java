package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

/** A forfeit proposed as a candidate for a daily vote. */
@Entity
@Table(name = "daily_gage_candidates",
       uniqueConstraints = @UniqueConstraint(columnNames = {"daily_gage_id", "forfeit_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailyGageCandidate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "daily_gage_id", nullable = false)
    private DailyGage dailyGage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "forfeit_id", nullable = false)
    private Forfeit forfeit;

    @OneToMany(mappedBy = "candidate", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<DailyGageVote> votes = new ArrayList<>();

    /** Net vote score (sum of all +1/-1 votes). */
    public int getVoteScore() {
        return votes.stream().mapToInt(DailyGageVote::getVote).sum();
    }
}

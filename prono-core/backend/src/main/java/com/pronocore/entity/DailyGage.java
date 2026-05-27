package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * One gage per calendar day.
 * <p>
 * Admin creates it BEFORE the day's matches start.
 * In DIRECT mode the admin picks the forfeit immediately (status→ACTIVE).
 * In VOTE mode the admin proposes candidates; players vote; the winner
 * is auto-selected when the last match of the day is settled.
 */
@Entity
@Table(name = "daily_gages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailyGage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The calendar day this gage belongs to. */
    @Column(name = "match_date", nullable = false, unique = true)
    private LocalDate matchDate;

    /** Selected forfeit (may be null until admin selects / vote closes). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "forfeit_id")
    private Forfeit forfeit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Mode mode = Mode.DIRECT;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.PENDING;

    /** The unlucky player who earned the fewest points that day. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to_id")
    private User assignedTo;

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "dailyGage", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<DailyGageCandidate> candidates = new ArrayList<>();

    public enum Mode   { DIRECT, VOTE }
    public enum Status { PENDING, ACTIVE, SETTLED }
}

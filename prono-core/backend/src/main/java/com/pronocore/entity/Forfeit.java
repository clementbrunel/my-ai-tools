package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "forfeits")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Forfeit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 100)
    @Builder.Default
    private String category = "General";

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;

    /** How many times this gage has been marked as completed across all users. */
    @Column(name = "times_completed", nullable = false)
    @Builder.Default
    private int timesCompleted = 0;

    /** Null = admin-created. Non-null = proposed by a player (visible immediately). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "proposed_by_id")
    private User proposedBy;

    /** Null = SHARED gage (visible to all groups). Non-null = belongs to that group only. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id")
    private Group group;

    /** Null = generic gage, shown regardless of sport. Non-null = only shown to groups playing that sport. */
    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private Sport sport;
}

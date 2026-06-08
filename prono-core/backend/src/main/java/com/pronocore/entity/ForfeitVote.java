package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
    name = "forfeit_votes",
    uniqueConstraints = @UniqueConstraint(columnNames = {"forfeit_id", "user_id"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ForfeitVote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "forfeit_id", nullable = false)
    private Forfeit forfeit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** +1 = upvote, -1 = downvote */
    @Column(nullable = false)
    private int vote;
}

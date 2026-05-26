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
}

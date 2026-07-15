package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "drivers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Driver {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100, unique = true)
    private String name;

    /** FIA three-letter code: VER, NOR… */
    @Column(nullable = false, length = 3)
    private String code;

    @Column(nullable = false)
    private int number;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "constructor_id", nullable = false)
    private Constructor constructor;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean isActive = true;
}

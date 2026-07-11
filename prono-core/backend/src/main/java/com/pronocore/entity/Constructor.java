package com.pronocore.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "constructors")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Constructor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100, unique = true)
    private String name;

    /** Team hex color (e.g. "#E8002D") — tints the mini-F1 cars in the frontend. */
    @Column(nullable = false, length = 7)
    private String color;
}

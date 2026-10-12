package com.mymoneyhub.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "institutions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Institution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private InstitutionType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "connector_type", nullable = false, length = 20)
    private ConnectorType connectorType;

    /** Meaning depends on {@link #connectorType}: Enable Banking ASPSP name (e.g. "Boursorama", "N26", "Revolut"), woob module
     *  name (e.g. "bnp"), or null for MANUAL institutions with no automated sync. */
    @Column(name = "external_ref", length = 100)
    private String externalRef;

    /** ENABLE_BANKING only: ISO country of the ASPSP (e.g. "FR"), paired with {@link #externalRef}. */
    @Column(name = "external_country", length = 2)
    private String externalCountry;

    /** ENABLE_BANKING only: session obtained after the user consented at the bank. */
    @Column(name = "external_session_id", length = 100)
    private String externalSessionId;

    @Column(name = "session_valid_until")
    private LocalDateTime sessionValidUntil;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    public enum InstitutionType {
        BANK, INSURANCE, INVESTMENT
    }

    public enum ConnectorType {
        ENABLE_BANKING, WOOB, MANUAL
    }
}

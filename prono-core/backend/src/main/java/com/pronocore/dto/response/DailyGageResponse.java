package com.pronocore.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DailyGageResponse {

    private Long   id;
    private Long   groupId;
    private String groupName;
    private LocalDate matchDate;

    /** Selected forfeit (null until admin picks one or vote closes). */
    private ForfeitResponse forfeit;

    /** DIRECT or VOTE. */
    private String mode;

    /** PENDING → ACTIVE → SETTLED. */
    private String status;

    /** The unlucky player (set when SETTLED). */
    private String assignedToUsername;
    private String assignedToDisplayName;
    private LocalDateTime assignedAt;

    /** Vote candidates (populated in VOTE mode). */
    private List<DailyGageCandidateResponse> candidates;

    private LocalDateTime createdAt;

    /** True when all matches of the day are finished but this gage is not yet settled. */
    private boolean canForceSettle;
}

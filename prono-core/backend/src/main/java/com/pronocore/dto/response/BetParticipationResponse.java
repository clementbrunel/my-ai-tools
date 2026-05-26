package com.pronocore.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BetParticipationResponse {

    private Long id;
    private Long betId;
    private UserResponse user;
    private String chosenOption;
    private String comment;
    private LocalDateTime createdAt;
}

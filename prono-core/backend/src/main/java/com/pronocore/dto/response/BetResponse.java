package com.pronocore.dto.response;

import com.pronocore.entity.Bet;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BetResponse {

    private Long id;
    private String title;
    private String description;
    private Long groupId;
    private String groupName;
    private MatchResponse match;
    private UserResponse creator;
    private Bet.BetType betType;
    private int points;
    private LocalDateTime deadline;
    private Bet.Status status;
    private String winningOption;
    private LocalDateTime createdAt;
    private long participationsCount;
    private boolean userParticipated;
}

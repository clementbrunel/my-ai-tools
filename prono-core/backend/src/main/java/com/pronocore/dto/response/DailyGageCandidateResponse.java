package com.pronocore.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DailyGageCandidateResponse {

    private Long   id;
    private ForfeitResponse forfeit;
    private int    voteScore;

    /** Current authenticated user's vote (-1, 0, or +1). 0 = no vote. */
    private int userVote;
}

package com.pronocore.dto.request;

import lombok.Data;

@Data
public class VoteForfeitRequest {
    /** +1 = upvote, -1 = downvote, 0 = remove vote */
    private int vote;
}

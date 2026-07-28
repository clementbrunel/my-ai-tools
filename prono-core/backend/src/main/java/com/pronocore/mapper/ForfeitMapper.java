package com.pronocore.mapper;

import com.pronocore.dto.response.ForfeitResponse;
import com.pronocore.entity.Forfeit;
import org.springframework.stereotype.Component;

@Component
public class ForfeitMapper {

    public ForfeitResponse toResponse(Forfeit f) {
        return toResponse(f, 0, 0);
    }

    public ForfeitResponse toResponse(Forfeit f, int voteScore, int userVote) {
        return ForfeitResponse.builder()
                .id(f.getId())
                .title(f.getTitle())
                .description(f.getDescription())
                .category(f.getCategory())
                .isActive(f.isActive())
                .timesCompleted(f.getTimesCompleted())
                .proposedByUsername(f.getProposedBy() != null ? f.getProposedBy().getUsername() : null)
                .proposedByDisplayName(f.getProposedBy() != null ? f.getProposedBy().getDisplayName() : null)
                .groupId(f.getGroup() != null ? f.getGroup().getId() : null)
                .groupName(f.getGroup() != null ? f.getGroup().getName() : null)
                .sport(f.getSport())
                .voteScore(voteScore)
                .userVote(userVote)
                .build();
    }
}

package com.pronocore.mapper;

import com.pronocore.dto.response.BetParticipationResponse;
import com.pronocore.dto.response.BetResponse;
import com.pronocore.entity.Bet;
import com.pronocore.entity.BetParticipation;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", uses = {UserMapper.class, MatchMapper.class})
public interface BetMapper {

    @Mapping(target = "participationsCount", ignore = true)
    @Mapping(target = "groupId", source = "group.id")
    @Mapping(target = "groupName", source = "group.name")
    @Mapping(target = "raceId", source = "race.id")
    @Mapping(target = "raceName", source = "race.name")
    BetResponse toResponse(Bet bet);

    @Mapping(target = "betId", source = "bet.id")
    BetParticipationResponse toParticipationResponse(BetParticipation participation);
}

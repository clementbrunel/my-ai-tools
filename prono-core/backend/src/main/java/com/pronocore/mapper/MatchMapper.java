package com.pronocore.mapper;

import com.pronocore.dto.response.MatchResponse;
import com.pronocore.entity.Match;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface MatchMapper {

    @Mapping(source = "teamA.name", target = "teamA")
    @Mapping(source = "teamB.name", target = "teamB")
    @Mapping(source = "teamA.iso2", target = "teamAIso2")
    @Mapping(source = "teamB.iso2", target = "teamBIso2")
    MatchResponse toResponse(Match match);
}

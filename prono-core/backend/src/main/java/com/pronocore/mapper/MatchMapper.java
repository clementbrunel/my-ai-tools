package com.pronocore.mapper;

import com.pronocore.dto.response.MatchResponse;
import com.pronocore.entity.Match;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.Map;

@Mapper(componentModel = "spring", imports = {Map.class})
public interface MatchMapper {

    @Mapping(
        target = "externalLinks",
        expression = "java(match.getExternalLinks() != null ? match.getExternalLinks().toMap() : Map.of())"
    )
    MatchResponse toResponse(Match match);
}

package com.pronocore.mapper;

import com.pronocore.dto.response.MatchResponse;
import com.pronocore.entity.Match;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface MatchMapper {

    MatchResponse toResponse(Match match);
}

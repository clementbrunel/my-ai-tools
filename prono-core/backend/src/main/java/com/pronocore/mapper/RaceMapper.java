package com.pronocore.mapper;

import com.pronocore.dto.response.RaceResponse;
import com.pronocore.entity.Race;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface RaceMapper {

    @Mapping(target = "competitionId", source = "competition.id")
    @Mapping(target = "openInUserGroups", ignore = true)
    @Mapping(target = "userPredicted", ignore = true)
    @Mapping(target = "predictionsCount", ignore = true)
    @Mapping(target = "results", ignore = true)
    RaceResponse toResponse(Race race);
}

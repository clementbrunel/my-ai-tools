package com.pronocore.dto.response;

import com.pronocore.entity.Sport;

public record CompetitionResponse(Long id, String name, Sport sport) {}

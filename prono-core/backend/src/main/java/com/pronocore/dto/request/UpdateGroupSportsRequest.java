package com.pronocore.dto.request;

import com.pronocore.entity.Sport;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.Set;

@Data
public class UpdateGroupSportsRequest {

    @NotEmpty
    private Set<Sport> sports;
}

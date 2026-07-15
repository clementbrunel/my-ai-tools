package com.pronocore.dto.request;

import com.pronocore.entity.Sport;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Set;

@Data
public class CreateGroupRequest {

    @NotBlank
    @Size(min = 2, max = 100)
    private String name;

    @Size(max = 500)
    private String description;

    /** Sports the group plays — defaults to FOOT when omitted. */
    private Set<Sport> sports;
}

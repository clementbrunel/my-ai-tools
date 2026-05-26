package com.pronocore.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ForfeitResponse {

    private Long id;
    private String title;
    private String description;
    private String category;
    private boolean isActive;
}

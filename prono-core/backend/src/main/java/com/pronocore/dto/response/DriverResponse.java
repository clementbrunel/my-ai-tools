package com.pronocore.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DriverResponse {

    private Long id;
    private String name;
    private String code;
    private int number;
    private Long constructorId;
    private String constructorName;
    /** Team hex color, tints the mini-F1 in the UI. */
    private String constructorColor;
}

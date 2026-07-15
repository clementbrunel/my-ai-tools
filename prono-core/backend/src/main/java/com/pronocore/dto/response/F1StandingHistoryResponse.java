package com.pronocore.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Cumulative points per race round for the top drivers/constructors — feeds the championship line chart. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class F1StandingHistoryResponse {

    private List<RacePoint> races;
    private List<Series> series;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RacePoint {
        private int round;
        private String name;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Series {
        private String label;
        /** Driver's 3-letter FIA code — null for constructor series. */
        private String code;
        private String color;
        private List<Integer> points;
    }
}

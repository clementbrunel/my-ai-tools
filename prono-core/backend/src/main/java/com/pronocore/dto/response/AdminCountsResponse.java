package com.pronocore.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminCountsResponse {
    private int pendingApplications;
    private Map<Long, Integer> pendingForfeitsPerGroup;
    private Map<Long, Integer> missingGagesPerGroup;
    private Map<Long, Boolean> groupsWithNoBets;
    private Map<Long, Integer> matchesWithoutBetsPerGroup;
}

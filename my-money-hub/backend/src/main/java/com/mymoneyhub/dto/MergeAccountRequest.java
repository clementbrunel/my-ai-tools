package com.mymoneyhub.dto;

import jakarta.validation.constraints.NotNull;

public record MergeAccountRequest(@NotNull Long targetId) {
}

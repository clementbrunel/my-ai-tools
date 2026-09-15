package com.mymoneyhub.dto;

import java.math.BigDecimal;
import java.util.List;

public record NetWorthDto(BigDecimal total, List<AccountDto> accounts) {
}

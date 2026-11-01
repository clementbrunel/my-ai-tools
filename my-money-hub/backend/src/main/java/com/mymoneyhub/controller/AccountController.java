package com.mymoneyhub.controller;

import com.mymoneyhub.dto.AccountDto;
import com.mymoneyhub.dto.NetWorthDto;
import com.mymoneyhub.dto.NetWorthPointDto;
import com.mymoneyhub.dto.UpdateBalanceRequest;
import com.mymoneyhub.service.AccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/accounts")
@RequiredArgsConstructor
public class AccountController {

    private final AccountService accountService;

    @GetMapping
    public List<AccountDto> listAll() {
        return accountService.listAll();
    }

    @GetMapping("/net-worth")
    public NetWorthDto netWorth() {
        return accountService.netWorth();
    }

    @GetMapping("/net-worth/history")
    public List<NetWorthPointDto> netWorthHistory() {
        return accountService.netWorthHistory();
    }

    @PutMapping("/{id}/balance")
    public AccountDto updateBalance(@PathVariable Long id, @Valid @RequestBody UpdateBalanceRequest request) {
        return accountService.updateManualBalance(id, request);
    }
}

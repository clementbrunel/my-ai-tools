package com.mymoneyhub.controller;

import com.mymoneyhub.dto.AccountDto;
import com.mymoneyhub.dto.MergeAccountRequest;
import com.mymoneyhub.dto.NetWorthDto;
import com.mymoneyhub.dto.UpdateBalanceRequest;
import com.mymoneyhub.service.AccountMergeService;
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
    private final AccountMergeService accountMergeService;

    @GetMapping
    public List<AccountDto> listAll() {
        return accountService.listAll();
    }

    @GetMapping("/net-worth")
    public NetWorthDto netWorth() {
        return accountService.netWorth();
    }

    @PutMapping("/{id}/balance")
    public AccountDto updateBalance(@PathVariable Long id, @Valid @RequestBody UpdateBalanceRequest request) {
        return accountService.updateManualBalance(id, request);
    }

    /** Merges this account with {@code targetId}; returns the surviving account (the synced one when they differ). */
    @PostMapping("/{id}/merge")
    public AccountDto merge(@PathVariable Long id, @Valid @RequestBody MergeAccountRequest request) {
        return accountMergeService.merge(id, request.targetId());
    }
}

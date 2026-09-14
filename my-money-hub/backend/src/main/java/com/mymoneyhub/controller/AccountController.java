package com.mymoneyhub.controller;

import com.mymoneyhub.dto.AccountDto;
import com.mymoneyhub.dto.NetWorthDto;
import com.mymoneyhub.service.AccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}

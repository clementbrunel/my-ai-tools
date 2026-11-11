package com.specmerger.controller;

import com.specmerger.config.SecurityProperties;
import com.specmerger.dto.AppConfigResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Settings of the deployment for the front, read at page load. Open to everyone (see SecurityConfig): it holds no
 * secret and must answer even when the user's session has expired.
 */
@RestController
@RequestMapping("/api/config")
public class AppConfigController {

    private final SecurityProperties security;

    public AppConfigController(SecurityProperties security) {
        this.security = security;
    }

    @GetMapping
    public AppConfigResponse get() {
        return new AppConfigResponse(security.enabled(), security.logoutRedirect());
    }
}

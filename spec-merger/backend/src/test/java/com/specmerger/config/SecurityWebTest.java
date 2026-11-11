package com.specmerger.config;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.specmerger.controller.AppConfigController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.boot.test.mock.mockito.MockBean;

@WebMvcTest(controllers = {SecurityWebTest.Probe.class, AppConfigController.class})
@Import({SecurityConfig.class, SecurityWebTest.Probe.class})
@TestPropertySource(properties = {
        "app.security.enabled=true",
        "app.security.issuer-uri=https://keycloak.invalid/realms/test",
        "app.security.logout-redirect=https://keycloak.invalid/logout",
        "app.frontend-url=http://localhost:5174"})
class SecurityWebTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    JwtDecoder jwtDecoder;

    @Test
    void apiWithoutTokenIsUnauthorized() throws Exception {
        mvc.perform(get("/api/probe")).andExpect(status().isUnauthorized());
    }

    @Test
    void apiWithValidTokenPassesSecurity() throws Exception {
        mvc.perform(get("/api/probe").with(jwt())).andExpect(status().isOk());
    }

    @Test
    void appConfigIsOpenSoTheFrontCanShowSignOutEvenAfterTheSessionExpired() throws Exception {
        mvc.perform(get("/api/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.oidcEnabled").value(true))
                .andExpect(jsonPath("$.logoutRedirect").value("https://keycloak.invalid/logout"));
    }

    @Test
    void onlyReadingTheConfigIsOpen() throws Exception {
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/config"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void preflightIsNotBlockedByAuthentication() throws Exception {
        mvc.perform(options("/api/probe")
                        .header("Origin", "http://localhost:5174")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "authorization"))
                .andExpect(status().isOk());
    }

    @RestController
    static class Probe {
        @GetMapping("/api/probe")
        String probe() {
            return "ok";
        }
    }
}

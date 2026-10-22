package com.specmerger.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

class SecurityConfigTest {

    private static Jwt jwtWithAudience(List<String> audience) {
        Jwt.Builder builder = Jwt.withTokenValue("t").header("alg", "RS256").subject("u")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60));
        if (audience != null) {
            builder.audience(audience);
        }
        return builder.build();
    }

    @Test
    void audienceValidatorAcceptsTokenCarryingTheAudience() {
        var validator = SecurityConfig.audienceValidator("spec-merger");
        assertThat(validator.validate(jwtWithAudience(List.of("account", "spec-merger"))).hasErrors()).isFalse();
    }

    @Test
    void audienceValidatorRejectsOtherOrMissingAudience() {
        var validator = SecurityConfig.audienceValidator("spec-merger");
        assertThat(validator.validate(jwtWithAudience(List.of("account"))).hasErrors()).isTrue();
        assertThat(validator.validate(jwtWithAudience(null)).hasErrors()).isTrue();
    }

    @Test
    void enabledWithoutIssuerFailsFast() {
        assertThatThrownBy(() -> new SecurityProperties(true, " ", ""))
                .isInstanceOf(IllegalStateException.class);
        assertThat(new SecurityProperties(false, null, null).issuerUri()).isEmpty();
    }
}

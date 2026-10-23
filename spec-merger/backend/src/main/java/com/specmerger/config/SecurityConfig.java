package com.specmerger.config;

import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;

/**
 * Stateless OIDC resource server. With {@code app.security.enabled=false} (OIDC_ENABLED) everything
 * is permitted (dev / mock mode, behaviour unchanged); with {@code true}, every request except
 * CORS preflights needs a valid bearer JWT. In the deployed stack the login itself is done by
 * oauth2-proxy in front of nginx, which forwards the user's JWT here: this check keeps the API
 * protected even if nginx is bypassed (the backend port is published). The caller's identity is
 * deliberately not used yet — the data is still keyed by the client-held session id — the token
 * only proves the caller is allowed in.
 */
@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(SecurityProperties.class)
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, SecurityProperties props) throws Exception {
        http.cors(Customizer.withDefaults())
                // Bearer tokens in the Authorization header, no cookie: nothing for CSRF to ride on.
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(h -> h
                        .contentTypeOptions(Customizer.withDefaults())
                        .frameOptions(f -> f.deny())
                        .referrerPolicy(r -> r.policy(ReferrerPolicy.NO_REFERRER)));
        if (props.enabled()) {
            http.authorizeHttpRequests(a -> a
                            .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                            .anyRequest().authenticated())
                    .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()));
        } else {
            http.authorizeHttpRequests(a -> a.anyRequest().permitAll());
        }
        return http.build();
    }

    /**
     * Built lazily from the issuer (keys fetched on first token), so the app still starts if
     * Keycloak is briefly unreachable. Signature, expiry and {@code iss} are always checked;
     * {@code aud} only when configured.
     */
    @Bean
    @ConditionalOnProperty(prefix = "app.security", name = "enabled", havingValue = "true")
    JwtDecoder jwtDecoder(SecurityProperties props) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withIssuerLocation(props.issuerUri()).build();
        List<OAuth2TokenValidator<Jwt>> validators = new ArrayList<>();
        validators.add(JwtValidators.createDefaultWithIssuer(props.issuerUri()));
        if (!props.audience().isEmpty()) {
            validators.add(audienceValidator(props.audience()));
        }
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(validators));
        return decoder;
    }

    static OAuth2TokenValidator<Jwt> audienceValidator(String audience) {
        OAuth2Error error = new OAuth2Error("invalid_token", "Audience attendue absente du token", null);
        return jwt -> jwt.getAudience() != null && jwt.getAudience().contains(audience)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(error);
    }
}

package com.mymoneyhub.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Local-network-only app (see CLAUDE.md) — no auth, CORS just needs to let the Vite dev
 *  server and the built frontend origin through. */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*")
                .allowedMethods("GET", "POST", "PUT", "DELETE");
    }
}

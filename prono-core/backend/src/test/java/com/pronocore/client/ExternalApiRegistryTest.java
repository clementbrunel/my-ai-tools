package com.pronocore.client;

import com.pronocore.entity.ExternalApi;
import com.pronocore.entity.Sport;
import com.pronocore.repository.ExternalApiRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExternalApiRegistryTest {

    private static final String FALLBACK = "https://configured.example";

    @Mock private ExternalApiRepository repository;

    @InjectMocks
    private ExternalApiRegistry registry;

    private ExternalApi provider(String baseUrl) {
        return ExternalApi.builder()
                .code(ExternalApi.JOLPICA_CODE).name("jolpica-f1").sport(Sport.F1)
                .baseUrl(baseUrl)
                .build();
    }

    @Test
    void prefersTheBaseUrlRegisteredInDatabase() {
        when(repository.findByCode(ExternalApi.JOLPICA_CODE))
                .thenReturn(Optional.of(provider("https://registry.example")));

        assertThat(registry.baseUrlOr(ExternalApi.JOLPICA_CODE, FALLBACK))
                .isEqualTo("https://registry.example");
    }

    @Test
    void fallsBackWhenProviderIsNotRegistered() {
        when(repository.findByCode("UNKNOWN")).thenReturn(Optional.empty());

        assertThat(registry.baseUrlOr("UNKNOWN", FALLBACK)).isEqualTo(FALLBACK);
    }

    @Test
    void fallsBackWhenRegisteredBaseUrlIsBlank() {
        when(repository.findByCode(ExternalApi.JOLPICA_CODE))
                .thenReturn(Optional.of(provider("   ")));

        assertThat(registry.baseUrlOr(ExternalApi.JOLPICA_CODE, FALLBACK)).isEqualTo(FALLBACK);
    }

    @Test
    void fallsBackWhenRegisteredBaseUrlIsNull() {
        when(repository.findByCode(ExternalApi.JOLPICA_CODE))
                .thenReturn(Optional.of(provider(null)));

        assertThat(registry.baseUrlOr(ExternalApi.JOLPICA_CODE, FALLBACK)).isEqualTo(FALLBACK);
    }

    /** A database that predates the registry migration must not take the clients down. */
    @Test
    void fallsBackWhenTheLookupFails() {
        when(repository.findByCode(ExternalApi.JOLPICA_CODE))
                .thenThrow(new IllegalStateException("relation external_apis does not exist"));

        assertThat(registry.baseUrlOr(ExternalApi.JOLPICA_CODE, FALLBACK)).isEqualTo(FALLBACK);
    }
}

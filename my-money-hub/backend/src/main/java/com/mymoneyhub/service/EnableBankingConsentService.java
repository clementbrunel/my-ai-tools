package com.mymoneyhub.service;

import com.mymoneyhub.connector.EnableBankingConnector;
import com.mymoneyhub.connector.EnableBankingException;
import com.mymoneyhub.entity.Institution;
import com.mymoneyhub.repository.InstitutionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Drives the Enable Banking consent round-trip: {@link #start} hands out the bank's authorization URL
 * with a random {@code state}; {@link #complete} matches the state the bank echoes back to the
 * institution and stores the resulting session on it. Pending states live in memory only — a backend
 * restart mid-consent just means clicking "Connecter" again.
 */
@Service
@RequiredArgsConstructor
public class EnableBankingConsentService {

    private static final Duration STATE_TTL = Duration.ofMinutes(30);

    private final EnableBankingConnector connector;
    private final InstitutionRepository institutionRepository;

    private final Map<String, PendingConsent> pendingByState = new ConcurrentHashMap<>();

    public String start(Institution institution) {
        if (institution.getConnectorType() != Institution.ConnectorType.ENABLE_BANKING) {
            throw new EnableBankingException("Institution " + institution.getName() + " does not use Enable Banking");
        }
        Instant now = Instant.now();
        pendingByState.values().removeIf(pending -> pending.expiresAt().isBefore(now));
        String state = UUID.randomUUID().toString();
        String url = connector.startAuthorization(institution, state);
        pendingByState.put(state, new PendingConsent(institution.getId(), now.plus(STATE_TTL)));
        return url;
    }

    @Transactional
    public Institution complete(String state, String code) {
        PendingConsent pending = state == null ? null : pendingByState.remove(state);
        if (pending == null || pending.expiresAt().isBefore(Instant.now())) {
            throw new EnableBankingException("Unknown or expired consent state — restart the connection");
        }
        Institution institution = institutionRepository.findById(pending.institutionId())
                .orElseThrow(() -> new EnableBankingException("Institution " + pending.institutionId() + " not found"));
        EnableBankingConnector.EnableBankingSession session = connector.createSession(code);
        institution.setExternalSessionId(session.sessionId());
        institution.setSessionValidUntil(session.validUntil());
        return institutionRepository.save(institution);
    }

    private record PendingConsent(Long institutionId, Instant expiresAt) {
    }
}

package com.mymoneyhub.connector;

import com.mymoneyhub.config.EnableBankingProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Instant;
import java.util.Base64;

/**
 * Builds the RS256 JWT Enable Banking expects as bearer token (enablebanking.com/docs/api):
 * header {@code kid} = application id, claims {@code iss=enablebanking.com}, {@code aud=api.enablebanking.com},
 * {@code iat}/{@code exp} (max 24h). The private key is the PEM downloaded when creating the application
 * on the Control Panel — PKCS#8 ({@code BEGIN PRIVATE KEY}); convert a PKCS#1 key with
 * {@code openssl pkcs8 -topk8 -nocrypt -in key.pem -out key-pkcs8.pem}.
 * <p>
 * The key is loaded lazily so the app still boots without Enable Banking configured.
 */
@Component
@RequiredArgsConstructor
public class EnableBankingJwtSigner {

    private static final long TOKEN_TTL_SECONDS = 3600;
    private static final long RENEW_MARGIN_SECONDS = 300;

    private final EnableBankingProperties properties;

    private PrivateKey privateKey;
    private String cachedToken;
    private Instant cachedTokenExpiry = Instant.EPOCH;

    public synchronized String token() {
        Instant now = Instant.now();
        if (cachedToken == null || now.isAfter(cachedTokenExpiry.minusSeconds(RENEW_MARGIN_SECONDS))) {
            Instant exp = now.plusSeconds(TOKEN_TTL_SECONDS);
            cachedToken = sign(now, exp);
            cachedTokenExpiry = exp;
        }
        return cachedToken;
    }

    private String sign(Instant iat, Instant exp) {
        if (isBlank(properties.applicationId()) || isBlank(properties.privateKeyPath())) {
            throw new EnableBankingException("Enable Banking not configured: set ENABLE_BANKING_APPLICATION_ID "
                    + "and ENABLE_BANKING_PRIVATE_KEY_PATH");
        }
        String header = "{\"typ\":\"JWT\",\"alg\":\"RS256\",\"kid\":\"" + properties.applicationId() + "\"}";
        String claims = "{\"iss\":\"enablebanking.com\",\"aud\":\"api.enablebanking.com\",\"iat\":"
                + iat.getEpochSecond() + ",\"exp\":" + exp.getEpochSecond() + "}";
        String signingInput = base64Url(header.getBytes(StandardCharsets.UTF_8)) + "."
                + base64Url(claims.getBytes(StandardCharsets.UTF_8));
        try {
            Signature signature = Signature.getInstance("SHA256withRSA");
            signature.initSign(privateKey());
            signature.update(signingInput.getBytes(StandardCharsets.US_ASCII));
            return signingInput + "." + base64Url(signature.sign());
        } catch (GeneralSecurityException e) {
            throw new EnableBankingException("failed to sign Enable Banking JWT", e);
        }
    }

    private PrivateKey privateKey() {
        if (privateKey == null) {
            try {
                String pem = Files.readString(Path.of(properties.privateKeyPath()));
                if (pem.contains("BEGIN RSA PRIVATE KEY")) {
                    throw new EnableBankingException("PKCS#1 key detected — convert it to PKCS#8: "
                            + "openssl pkcs8 -topk8 -nocrypt -in key.pem -out key-pkcs8.pem");
                }
                String base64 = pem.replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", "");
                privateKey = KeyFactory.getInstance("RSA")
                        .generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(base64)));
            } catch (IOException | GeneralSecurityException | IllegalArgumentException e) {
                throw new EnableBankingException("cannot load Enable Banking private key from "
                        + properties.privateKeyPath(), e);
            }
        }
        return privateKey;
    }

    private static String base64Url(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}

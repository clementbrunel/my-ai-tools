package com.pronocore.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;

public final class GravatarUtil {

    private static final String BASE_URL = "https://www.gravatar.com/avatar/";

    private GravatarUtil() {
    }

    public static String urlFor(String email) {
        String hash = md5Hex(email.trim().toLowerCase(Locale.ROOT));
        // d=404 makes Gravatar return HTTP 404 when the email has no custom avatar,
        // instead of a generated identicon — the frontend falls back to the initial then.
        return BASE_URL + hash + "?d=404&s=200";
    }

    private static String md5Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("MD5");
            byte[] hashBytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hashBytes.length * 2);
            for (byte b : hashBytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("MD5 algorithm not available", e);
        }
    }
}

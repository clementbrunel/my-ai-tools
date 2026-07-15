package com.pronocore.service.email;

/**
 * Color palette applied to the email header/gradient. One constant per sport
 * PronoCore covers, so a template only needs to swap the theme it passes to
 * {@link EmailLayout#wrap} to re-skin an email for a different competition.
 *
 * Values mirror the frontend's per-sport palette (primary-dark, primary,
 * accent, accent-mid) in frontend/src/themes/index.ts, so the email header
 * gradient matches the site's ".wc-header" gradient. Keep both in sync.
 */
public record EmailTheme(String gradientStart, String gradientEnd, String accentColor, String subtitleColor) {

    public static final EmailTheme FOOTBALL = new EmailTheme("#006400", "#009900", "#FFD700", "#FFA500");

    public static final EmailTheme F1 = new EmailTheme("#9B0400", "#E10600", "#C0C0C0", "#A0A0A0");

    /** Sport-neutral palette for templates that aren't tied to Foot or F1 (account emails, tech tests). */
    public static final EmailTheme NEUTRAL = new EmailTheme("#1E3A5F", "#2C5F8A", "#FFC857", "#8FB8D8");
}

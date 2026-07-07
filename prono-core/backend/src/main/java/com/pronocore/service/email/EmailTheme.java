package com.pronocore.service.email;

/**
 * Color palette applied to the email header/gradient. One constant per sport
 * PronoCore covers, so a template only needs to swap the theme it passes to
 * {@link EmailLayout#wrap} to re-skin an email for a different competition.
 */
public record EmailTheme(String gradientStart, String gradientEnd, String accentColor, String subtitleColor) {

    public static final EmailTheme FOOTBALL = new EmailTheme("#1a472a", "#2d6a4f", "#FFD700", "#90EE90");

    public static final EmailTheme F1 = new EmailTheme("#15151e", "#e10600", "#FFFFFF", "#c9c9d1");
}

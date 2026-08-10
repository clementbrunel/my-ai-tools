package com.pronocore.util;

import java.time.ZoneId;

/**
 * Time conventions shared by the whole app.
 *
 * <p>Match and race dates are stored as Paris local wall time (the backend
 * container also runs with {@code TZ=Europe/Paris}). External providers return
 * offset-qualified instants, so every importer converts through this zone
 * rather than truncating the offset.
 */
public final class AppTime {

    private AppTime() {}

    public static final ZoneId APP_ZONE = ZoneId.of("Europe/Paris");
}

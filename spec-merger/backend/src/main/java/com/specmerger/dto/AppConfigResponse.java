package com.specmerger.dto;

/**
 * Runtime settings the front needs before anything else.
 *
 * @param oidcEnabled    true when a proxy logs the user in in front of the app: the front then offers sign-out
 * @param logoutRedirect where oauth2-proxy sends the browser after sign-out, empty when there is none
 */
public record AppConfigResponse(boolean oidcEnabled, String logoutRedirect) {
}

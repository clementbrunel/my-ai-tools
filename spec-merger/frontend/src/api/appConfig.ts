// Runtime config served by nginx (/config.json, written at container start from OIDC_ENABLED &
// co.) — not baked into the bundle, so toggling OIDC doesn't need a rebuild. Anything unusable
// (dev server without nginx, bad JSON) means "no OIDC": no logout button.
export interface AppConfig {
  oidcEnabled: boolean
  /** Where oauth2-proxy sends the browser after clearing its cookie — typically the Keycloak
   * end-session URL, so the SSO session ends too instead of silently logging the user back in. */
  logoutRedirect: string
}

const DISABLED: AppConfig = { oidcEnabled: false, logoutRedirect: '' }

export async function loadAppConfig(): Promise<AppConfig> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' })
    if (!response.ok) return DISABLED
    const data = await response.json()
    return {
      oidcEnabled: data?.oidcEnabled === true,
      logoutRedirect: typeof data?.logoutRedirect === 'string' ? data.logoutRedirect : '',
    }
  } catch {
    return DISABLED
  }
}

/** oauth2-proxy's sign-out endpoint, behind the same origin/base path as the app and the API. */
export function buildLogoutUrl(config: AppConfig): string {
  const base = `${import.meta.env.BASE_URL}oauth2/sign_out`
  return config.logoutRedirect ? `${base}?rd=${encodeURIComponent(config.logoutRedirect)}` : base
}

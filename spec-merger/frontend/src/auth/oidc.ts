import { UserManager, WebStorageStateStore } from 'oidc-client-ts'

// Realm URL of the OIDC provider (Keycloak), e.g. https://keycloak.example.org/realms/my-realm.
// Empty = authentication disabled (local dev / mock mode): no login, no Authorization header.
const authority = (import.meta.env.VITE_OIDC_AUTHORITY ?? '').trim()
const clientId = (import.meta.env.VITE_OIDC_CLIENT_ID ?? '').trim()

export const authEnabled = authority !== '' && clientId !== ''

// Authorization Code + PKCE (public client, no secret). Tokens stay in sessionStorage, so they
// die with the tab instead of lingering in localStorage; renewal goes through the refresh token.
export const userManager: UserManager | null = authEnabled
  ? new UserManager({
      authority,
      client_id: clientId,
      redirect_uri: `${window.location.origin}${import.meta.env.BASE_URL}`,
      post_logout_redirect_uri: `${window.location.origin}${import.meta.env.BASE_URL}`,
      response_type: 'code',
      scope: 'openid profile email',
      automaticSilentRenew: true,
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    })
  : null

export async function getAccessToken(): Promise<string | null> {
  const user = await userManager?.getUser()
  return user && !user.expired ? user.access_token : null
}

export function login(): Promise<void> {
  return userManager ? userManager.signinRedirect() : Promise.resolve()
}

export function logout(): Promise<void> {
  return userManager ? userManager.signoutRedirect() : Promise.resolve()
}

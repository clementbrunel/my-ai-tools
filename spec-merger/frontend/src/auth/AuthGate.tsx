import { useEffect, useState, type ReactNode } from 'react'
import FullPageLoader from '../components/FullPageLoader'
import { authEnabled, login, userManager } from './oidc'

interface AuthGateProps {
  children: ReactNode
}

function isCallback(): boolean {
  const params = new URLSearchParams(window.location.search)
  return params.has('code') && params.has('state')
}

/**
 * Renders the app only once the user is signed in with the OIDC provider, redirecting to it
 * otherwise. A transparent pass-through when no provider is configured (VITE_OIDC_AUTHORITY
 * empty). The signed-in identity isn't used by the app yet — it only gates access.
 */
function AuthGate({ children }: AuthGateProps) {
  const [ready, setReady] = useState(!authEnabled)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userManager) return
    let cancelled = false
    ;(async () => {
      try {
        if (isCallback()) {
          await userManager.signinRedirectCallback()
          // Drop ?code&state from the URL so a reload doesn't replay the callback.
          window.history.replaceState({}, document.title, import.meta.env.BASE_URL)
        }
        const user = await userManager.getUser()
        if (user && !user.expired) {
          if (!cancelled) setReady(true)
        } else {
          await login()
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div role="alert" className="p-6 text-sm text-red-700">
        Échec de l'authentification : {error}{' '}
        <button className="underline" onClick={() => void login()}>
          Réessayer
        </button>
      </div>
    )
  }
  if (!ready) return <FullPageLoader message="Authentification…" />
  return <>{children}</>
}

export default AuthGate

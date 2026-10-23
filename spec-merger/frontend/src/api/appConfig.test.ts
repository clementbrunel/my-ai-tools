import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildLogoutUrl, loadAppConfig } from './appConfig'

afterEach(() => vi.unstubAllGlobals())

function stubFetch(impl: () => Promise<unknown>) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

describe('loadAppConfig', () => {
  it('reads the runtime config served by nginx', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ oidcEnabled: true, logoutRedirect: 'https://kc/logout' }) }))
    expect(await loadAppConfig()).toEqual({ oidcEnabled: true, logoutRedirect: 'https://kc/logout' })
  })

  it('treats a missing or broken config as OIDC disabled', async () => {
    stubFetch(async () => ({ ok: false }))
    expect((await loadAppConfig()).oidcEnabled).toBe(false)
    stubFetch(async () => ({ ok: true, json: async () => { throw new Error('not json') } }))
    expect((await loadAppConfig()).oidcEnabled).toBe(false)
    stubFetch(async () => { throw new Error('network') })
    expect((await loadAppConfig()).oidcEnabled).toBe(false)
  })

  it('only trusts a literal true', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ oidcEnabled: 'true' }) }))
    expect((await loadAppConfig()).oidcEnabled).toBe(false)
  })
})

describe('buildLogoutUrl', () => {
  it('goes through oauth2-proxy sign_out, then on to the configured redirect', () => {
    expect(buildLogoutUrl({ oidcEnabled: true, logoutRedirect: '' })).toBe('/oauth2/sign_out')
    expect(buildLogoutUrl({ oidcEnabled: true, logoutRedirect: 'https://kc/logout?a=b' })).toBe(
      '/oauth2/sign_out?rd=https%3A%2F%2Fkc%2Flogout%3Fa%3Db',
    )
  })
})

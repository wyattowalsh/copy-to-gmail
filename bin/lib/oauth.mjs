import { createHash, randomBytes } from 'node:crypto'
import { readTokenRecord, writeTokenRecord } from './token-store.mjs'

export const draftScopes = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.compose',
]

export const signatureScopes = [
  ...draftScopes,
  'https://www.googleapis.com/auth/gmail.settings.basic',
]

const tokenUrl = 'https://oauth2.googleapis.com/token'
const userInfoUrl = 'https://www.googleapis.com/oauth2/v3/userinfo'

export function createOAuthStart({ config, origin, scopes = draftScopes }) {
  const codeVerifier = base64Url(randomBytes(64))
  const codeChallenge = base64Url(
    createHash('sha256').update(codeVerifier).digest(),
  )
  const state = base64Url(randomBytes(32))
  const redirectUri = `${origin}/api/gmail/oauth/callback`
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', scopes.join(' '))
  url.searchParams.set('state', state)

  return { codeVerifier, redirectUri, state, url: url.toString() }
}

export async function exchangeOAuthCode({
  code,
  config,
  codeVerifier,
  redirectUri,
}) {
  const tokenResponse = await postForm(tokenUrl, {
    client_id: config.clientId,
    client_secret: config.clientSecret ?? '',
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })
  const profile = await fetchJson(userInfoUrl, {
    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
  })
  const record = tokenRecordFromResponse(tokenResponse, profile.email)
  await writeTokenRecord(record)
  return record
}

export async function getAccessToken(config) {
  const record = await readTokenRecord()

  if (!record?.refreshToken && !record?.accessToken) {
    return null
  }

  if (record.accessToken && record.expiresAt > Date.now() + 60_000) {
    return record
  }

  if (!record.refreshToken) {
    return null
  }

  const tokenResponse = await postForm(tokenUrl, {
    client_id: config.clientId,
    client_secret: config.clientSecret ?? '',
    grant_type: 'refresh_token',
    refresh_token: record.refreshToken,
  })
  const next = tokenRecordFromResponse(tokenResponse, record.email, record)
  await writeTokenRecord(next)
  return next
}

function tokenRecordFromResponse(response, email, existing = {}) {
  return {
    accessToken: response.access_token ?? existing.accessToken,
    email: email ?? existing.email ?? '',
    expiresAt: Date.now() + Number(response.expires_in ?? 0) * 1000,
    refreshToken: response.refresh_token ?? existing.refreshToken,
    scopes: String(response.scope ?? existing.scopes?.join?.(' ') ?? '')
      .split(/\s+/)
      .filter(Boolean),
  }
}

async function postForm(url, form) {
  return fetchJson(url, {
    body: new URLSearchParams(form),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  })
}

async function fetchJson(url, init) {
  const response = await fetch(url, init)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      data.error_description ?? data.error ?? 'OAuth request failed.',
    )
  }

  return data
}

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

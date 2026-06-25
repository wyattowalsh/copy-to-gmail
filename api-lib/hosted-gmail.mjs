import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'
import {
  createDraft,
  fingerprintDraft,
  getDraft,
  listDrafts,
  listSignatures,
  updateDraft,
} from '../bin/lib/gmail-client.mjs'

const draftScopes = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.compose',
]
const signatureScopes = [
  ...draftScopes,
  'https://www.googleapis.com/auth/gmail.settings.basic',
]
const oauthCookieName = '__Host-ctg_oauth'
const tokenCookieName = '__Host-ctg_token'
const oauthTtlSeconds = 10 * 60
const tokenTtlSeconds = 60 * 60 * 24 * 30
const tokenUrl = 'https://oauth2.googleapis.com/token'
const userInfoUrl = 'https://www.googleapis.com/oauth2/v3/userinfo'

export function handleOptions() {
  return json({ error: 'CORS preflight is not supported.' }, 405)
}

export async function handleStatus(request) {
  const config = readGoogleOAuthConfig()
  const token = config ? readTokenCookie(request, config) : null

  return json({
    connected: Boolean(token?.refreshToken || token?.accessToken),
    email: token?.email,
    needsConfig: !config,
    scopes: token?.scopes ?? [],
  })
}

export async function handleConnect(request) {
  const origin = getOrigin(request)

  if (!isSameOriginNavigation(request, origin)) {
    return json({ error: 'API request origin is not allowed.' }, 403)
  }

  const config = readGoogleOAuthConfig()

  if (!config) {
    return json(
      {
        error:
          'Missing Google OAuth config. Set COPY_TO_GMAIL_GOOGLE_CLIENT_ID for the hosted deployment.',
      },
      400,
    )
  }

  const url = new URL(request.url)
  const scopes =
    url.searchParams.get('scope') === 'signatures'
      ? signatureScopes
      : draftScopes
  const oauth = createOAuthStart({ config, origin, scopes })
  const response = redirect(oauth.url)
  response.headers.append(
    'Set-Cookie',
    writeSealedCookie(oauthCookieName, oauth, config, oauthTtlSeconds),
  )
  return response
}

export async function handleCallback(request) {
  const config = readGoogleOAuthConfig()

  if (!config) {
    return redirect('/?gmail=error')
  }

  const url = new URL(request.url)
  const state = url.searchParams.get('state') ?? ''
  const code = url.searchParams.get('code') ?? ''
  const oauth = readSealedCookie(request, oauthCookieName, config)
  const response = redirect('/?gmail=error')
  response.headers.append('Set-Cookie', clearCookie(oauthCookieName))

  if (
    !oauth ||
    !code ||
    oauth.state !== state ||
    Date.now() - Number(oauth.createdAt ?? 0) > oauthTtlSeconds * 1000
  ) {
    return response
  }

  try {
    const token = await exchangeOAuthCode({
      code,
      codeVerifier: oauth.codeVerifier,
      config,
      redirectUri: oauth.redirectUri,
    })
    const connected = redirect('/?gmail=connected')
    connected.headers.append('Set-Cookie', clearCookie(oauthCookieName))
    connected.headers.append(
      'Set-Cookie',
      writeSealedCookie(tokenCookieName, token, config, tokenTtlSeconds),
    )
    return connected
  } catch {
    return response
  }
}

export async function handleDisconnect(request) {
  const origin = getOrigin(request)

  if (!isSameOriginWrite(request, origin)) {
    return json({ error: 'API request origin is not allowed.' }, 403)
  }

  const response = json({ connected: false, scopes: [] })
  response.headers.append('Set-Cookie', clearCookie(tokenCookieName))
  return response
}

export async function handleListDrafts(request) {
  const { response, token } = await requireAccess(request)
  const drafts = await listDrafts(token.accessToken)
  return withPendingCookies(json({ drafts }), response)
}

export async function handleCreateDraft(request) {
  const origin = getOrigin(request)

  if (!isSameOriginWrite(request, origin)) {
    return json({ error: 'API request origin is not allowed.' }, 403)
  }

  const body = await readJsonBody(request)
  const draft = readDraftPayload(body)
  const { response, token } = await requireAccess(request)
  const result = await createDraft(token.accessToken, draft)
  attachAccount(result, token.email)
  return withPendingCookies(json(result), response)
}

export async function handleGetDraft(request, draftId) {
  const { response, token } = await requireAccess(request)
  const result = await getDraft(token.accessToken, draftId)
  attachAccount(result, token.email)
  return withPendingCookies(json(result), response)
}

export async function handleUpdateDraft(request, draftId) {
  const origin = getOrigin(request)

  if (!isSameOriginWrite(request, origin)) {
    return json({ error: 'API request origin is not allowed.' }, 403)
  }

  const body = await readJsonBody(request)
  const draft = readDraftPayload(body)
  const { response, token } = await requireAccess(request)

  if (typeof body.expectedFingerprint === 'string') {
    const remote = await getDraft(token.accessToken, draftId)
    attachAccount(remote, token.email)

    if (remote.fingerprint !== body.expectedFingerprint) {
      return withPendingCookies(
        json(
          {
            error:
              'The Gmail draft changed outside Copy to Gmail. Resolve the conflict before syncing.',
            remoteDraft: remote.draft,
            remoteFingerprint: remote.fingerprint,
          },
          409,
        ),
        response,
      )
    }
  }

  const result = await updateDraft(token.accessToken, draftId, draft)
  attachAccount(result, token.email)
  return withPendingCookies(json(result), response)
}

export async function handleSignatures(request) {
  const { response, token } = await requireAccess(request)

  if (
    !token.scopes?.includes(
      'https://www.googleapis.com/auth/gmail.settings.basic',
    )
  ) {
    return withPendingCookies(
      json(
        {
          error:
            'Gmail signature import needs the additional Gmail settings permission.',
        },
        403,
      ),
      response,
    )
  }

  const signatures = await listSignatures(token.accessToken)
  return withPendingCookies(json({ signatures }), response)
}

export function handleLibraryGet() {
  return json({
    version: 1,
    signatures: [],
    templates: [],
    variableSets: [],
  })
}

export async function handleLibraryPut(request) {
  const origin = getOrigin(request)

  if (!isSameOriginWrite(request, origin)) {
    return json({ error: 'API request origin is not allowed.' }, 403)
  }

  const body = await readJsonBody(request)
  const library = body?.library
  return json({
    version: 1,
    signatures: Array.isArray(library?.signatures) ? library.signatures : [],
    templates: Array.isArray(library?.templates) ? library.templates : [],
    variableSets: Array.isArray(library?.variableSets)
      ? library.variableSets
      : [],
  })
}

export function handleError(error) {
  return json(
    { error: error instanceof Error ? error.message : 'API request failed.' },
    error instanceof ApiError ? error.statusCode : 500,
  )
}

export function methodNotAllowed() {
  return json({ error: 'Method not allowed.' }, 405)
}

async function requireAccess(request) {
  const config = readGoogleOAuthConfig()

  if (!config) {
    throw new ApiError('Google OAuth config is not available.', 400)
  }

  const token = readTokenCookie(request, config)

  if (!token?.accessToken && !token?.refreshToken) {
    throw new ApiError('Gmail is not connected. Reconnect your account.', 401)
  }

  if (token.accessToken && token.expiresAt > Date.now() + 60_000) {
    return { response: new Response(null), token }
  }

  if (!token.refreshToken) {
    throw new ApiError('Gmail is not connected. Reconnect your account.', 401)
  }

  const refreshed = await refreshAccessToken(config, token)
  const response = new Response(null)
  response.headers.append(
    'Set-Cookie',
    writeSealedCookie(tokenCookieName, refreshed, config, tokenTtlSeconds),
  )
  return { response, token: refreshed }
}

function readGoogleOAuthConfig() {
  const clientId =
    process.env.COPY_TO_GMAIL_GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID
  const clientSecret =
    process.env.COPY_TO_GMAIL_GOOGLE_CLIENT_SECRET ??
    process.env.GOOGLE_CLIENT_SECRET
  const sessionSecret = process.env.COPY_TO_GMAIL_SESSION_SECRET ?? clientSecret

  if (!clientId || !sessionSecret) {
    return null
  }

  return { clientId, clientSecret: clientSecret ?? '', sessionSecret }
}

function createOAuthStart({ config, origin, scopes }) {
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

  return {
    codeVerifier,
    createdAt: Date.now(),
    redirectUri,
    state,
    url: url.toString(),
  }
}

async function exchangeOAuthCode({ code, config, codeVerifier, redirectUri }) {
  const tokenResponse = await postForm(tokenUrl, {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })
  const profile = await fetchJson(userInfoUrl, {
    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
  })
  return tokenRecordFromResponse(tokenResponse, profile.email)
}

async function refreshAccessToken(config, current) {
  const tokenResponse = await postForm(tokenUrl, {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: current.refreshToken,
  })
  return tokenRecordFromResponse(tokenResponse, current.email, current)
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

function readTokenCookie(request, config) {
  return readSealedCookie(request, tokenCookieName, config)
}

function readSealedCookie(request, name, config) {
  const value = parseCookies(request.headers.get('cookie') ?? '')[name]

  if (!value) {
    return null
  }

  try {
    return unseal(value, config.sessionSecret)
  } catch {
    return null
  }
}

function writeSealedCookie(name, value, config, maxAge) {
  return serializeCookie(name, seal(value, config.sessionSecret), maxAge)
}

function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

function seal(value, secret) {
  const key = createHash('sha256').update(secret).digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, ciphertext].map(base64Url).join('.')
}

function unseal(value, secret) {
  const [ivValue, tagValue, ciphertextValue] = value.split('.')

  if (!ivValue || !tagValue || !ciphertextValue) {
    throw new Error('Cookie value is malformed.')
  }

  const key = createHash('sha256').update(secret).digest()
  const iv = base64UrlDecode(ivValue)
  const tag = base64UrlDecode(tagValue)
  const ciphertext = base64UrlDecode(ciphertextValue)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return JSON.parse(plaintext.toString('utf8'))
}

function serializeCookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
}

function parseCookies(header) {
  const cookies = {}

  for (const part of header.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=')

    if (rawName) {
      cookies[rawName] = rawValue.join('=')
    }
  }

  return cookies
}

async function readJsonBody(request) {
  const contentType = request.headers.get('content-type') ?? ''

  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw new ApiError('Request body must be application/json.', 415)
  }

  const raw = await request.text()

  if (raw.length > 1_000_000) {
    throw new ApiError('Request body is too large.', 413)
  }

  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    throw new ApiError('Request body must be valid JSON.', 400)
  }
}

function readDraftPayload(body) {
  if (!isPlainRecord(body) || !isPlainRecord(body.draft)) {
    throw new ApiError('Request body must include a draft object.', 400)
  }

  return body.draft
}

function isPlainRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function attachAccount(result, accountEmail) {
  result.draft.gmail.accountEmail = accountEmail
}

function withPendingCookies(response, pendingResponse) {
  for (const cookie of pendingResponse.headers.getSetCookie?.() ?? []) {
    response.headers.append('Set-Cookie', cookie)
  }
  const fallback = pendingResponse.headers.get('set-cookie')

  if (fallback) {
    response.headers.append('Set-Cookie', fallback)
  }

  return response
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
    status,
  })
}

function redirect(location) {
  return new Response(null, {
    headers: {
      'Cache-Control': 'no-store',
      Location: location,
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
    status: 302,
  })
}

function getOrigin(request) {
  const url = new URL(request.url)
  const proto =
    request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    url.host
  return `${proto}://${host}`
}

function isSameOriginWrite(request, origin) {
  const requestOrigin = request.headers.get('origin')

  if (requestOrigin && requestOrigin !== origin) {
    return false
  }

  const fetchSite = request.headers.get('sec-fetch-site')?.toLowerCase()
  return !fetchSite || fetchSite === 'same-origin'
}

function isSameOriginNavigation(request, origin) {
  const requestOrigin = request.headers.get('origin')

  if (requestOrigin && requestOrigin !== origin) {
    return false
  }

  const fetchSite = request.headers.get('sec-fetch-site')?.toLowerCase()
  return !fetchSite || fetchSite === 'same-origin' || fetchSite === 'none'
}

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function base64UrlDecode(value) {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

class ApiError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
  }
}

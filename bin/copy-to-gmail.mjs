#!/usr/bin/env node

import { createServer } from 'node:http'
import { createReadStream, existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import net from 'node:net'
import {
  appendDraftSnapshot,
  readLibraryBundle,
  writeLibraryBundle,
} from './lib/app-data.mjs'
import { readGoogleOAuthConfig } from './lib/config.mjs'
import {
  createDraft,
  getDraft,
  listSignatures,
  listDrafts,
  updateDraft,
} from './lib/gmail-client.mjs'
import {
  createOAuthStart,
  signatureScopes,
  exchangeOAuthCode,
  getAccessToken,
} from './lib/oauth.mjs'
import { deleteTokenRecord, readTokenRecord } from './lib/token-store.mjs'

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)))
const distDir = join(rootDir, 'dist')
const packageJsonPath = join(rootDir, 'package.json')
const defaultHost = '127.0.0.1'
const defaultPortRange = { min: 42000, max: 60999 }
const oauthSessionTtlMs = 10 * 60 * 1000
const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
].join('; ')

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
])
const oauthSessions = new Map()

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  printHelp()
  process.exit(0)
}

if (args.version) {
  console.log(await readPackageVersion())
  process.exit(0)
}

if (args.host !== defaultHost) {
  console.error(
    'copy-to-gmail only binds to 127.0.0.1 to protect draft content.',
  )
  process.exit(1)
}

if (!existsSync(join(distDir, 'index.html'))) {
  console.error(
    'Built app assets are missing. Run `pnpm build` before starting the packaged server.',
  )
  process.exit(1)
}

const port = args.port ?? (Number(process.env.PORT) || (await findOpenPort()))
const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error) => {
    if (response.headersSent) {
      response.destroy(error)
      return
    }

    sendJson(
      response,
      {
        error:
          error instanceof Error ? error.message : 'Request could not be read.',
      },
      error instanceof ApiError ? error.statusCode : 500,
    )
  })
})

server.listen(port, args.host, () => {
  const url = `http://${args.host}:${port}/`
  console.log(`Copy to Gmail is running at ${url}`)

  if (args.open) {
    openBrowser(url)
  }
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}

async function handleRequest(request, response) {
  const origin = `http://${args.host}:${port}`
  const parsedUrl = new URL(request.url ?? '/', origin)

  if (parsedUrl.pathname.startsWith('/api/')) {
    await handleApiRequest(request, response, parsedUrl, origin)
    return
  }

  const pathname = decodeRequestPath(parsedUrl.pathname)
  const candidatePath = normalize(join(distDir, pathname))
  const isInsideDist =
    candidatePath === distDir || candidatePath.startsWith(`${distDir}/`)
  const filePath =
    isInsideDist && existsSync(candidatePath) && !pathname.endsWith('/')
      ? candidatePath
      : join(distDir, 'index.html')
  const mimeType =
    mimeTypes.get(extname(filePath)) ?? 'application/octet-stream'

  response.setHeader('Content-Type', mimeType)
  setSecurityHeaders(response)
  createReadStream(filePath).pipe(response)
}

async function handleApiRequest(request, response, parsedUrl, origin) {
  try {
    if (request.method === 'OPTIONS') {
      sendJson(response, { error: 'CORS preflight is not supported.' }, 405)
      return
    }

    if (!isExpectedLocalHost(request, args.host, port)) {
      sendJson(response, { error: 'API request host is not allowed.' }, 403)
      return
    }

    if (isWriteRequest(request) && !isSameOriginWrite(request, origin)) {
      sendJson(response, { error: 'API request origin is not allowed.' }, 403)
      return
    }

    if (parsedUrl.pathname === '/api/gmail/status') {
      await handleGmailStatus(response)
      return
    }

    if (
      parsedUrl.pathname === '/api/gmail/connect' &&
      !isSameOriginNavigation(request, origin)
    ) {
      sendJson(response, { error: 'API request origin is not allowed.' }, 403)
      return
    }

    if (parsedUrl.pathname === '/api/gmail/connect') {
      await handleGmailConnect(response, origin, parsedUrl)
      return
    }

    if (parsedUrl.pathname === '/api/library' && request.method === 'GET') {
      sendJson(response, await readLibraryBundle())
      return
    }

    if (parsedUrl.pathname === '/api/library' && request.method === 'PUT') {
      const body = await readJsonBody(request)
      sendJson(response, await writeLibraryBundle(body.library))
      return
    }

    if (parsedUrl.pathname === '/api/gmail/oauth/callback') {
      await handleGmailCallback(response, parsedUrl)
      return
    }

    if (
      parsedUrl.pathname === '/api/gmail/disconnect' &&
      request.method === 'POST'
    ) {
      await deleteTokenRecord()
      sendJson(response, { connected: false, scopes: [] })
      return
    }

    if (
      parsedUrl.pathname === '/api/gmail/drafts' &&
      request.method === 'GET'
    ) {
      const { token } = await requireGmailAccess()
      sendJson(response, { drafts: await listDrafts(token.accessToken) })
      return
    }

    if (
      parsedUrl.pathname === '/api/gmail/signatures' &&
      request.method === 'GET'
    ) {
      const { token } = await requireGmailAccess()

      if (
        !token.scopes?.includes(
          'https://www.googleapis.com/auth/gmail.settings.basic',
        )
      ) {
        sendJson(
          response,
          {
            error:
              'Gmail signature import needs the additional Gmail settings permission.',
          },
          403,
        )
        return
      }

      sendJson(response, {
        signatures: await listSignatures(token.accessToken),
      })
      return
    }

    if (
      parsedUrl.pathname === '/api/gmail/drafts' &&
      request.method === 'POST'
    ) {
      const body = await readJsonBody(request)
      const draft = readDraftPayload(body)
      const { token } = await requireGmailAccess()
      const result = await createDraft(token.accessToken, draft)
      attachAccount(result, token.email)
      await appendDraftSnapshot(token.email, result.draft.gmail.draftId, {
        draft: result.draft,
        fingerprint: result.fingerprint,
        savedAt: new Date().toISOString(),
        source: 'create',
      })
      sendJson(response, result)
      return
    }

    const draftMatch = parsedUrl.pathname.match(
      /^\/api\/gmail\/drafts\/([^/]+)$/,
    )

    if (draftMatch && request.method === 'GET') {
      const { token } = await requireGmailAccess()
      const result = await getDraft(
        token.accessToken,
        decodeRequestPath(draftMatch[1]),
      )
      attachAccount(result, token.email)
      sendJson(response, result)
      return
    }

    if (draftMatch && request.method === 'PUT') {
      const body = await readJsonBody(request)
      const draft = readDraftPayload(body)
      const draftId = decodeRequestPath(draftMatch[1])
      const { token } = await requireGmailAccess()

      if (typeof body.expectedFingerprint === 'string') {
        const remote = await getDraft(token.accessToken, draftId)
        attachAccount(remote, token.email)

        if (remote.fingerprint !== body.expectedFingerprint) {
          sendJson(
            response,
            {
              error:
                'The Gmail draft changed outside Copy to Gmail. Resolve the conflict before syncing.',
              remoteDraft: remote.draft,
              remoteFingerprint: remote.fingerprint,
            },
            409,
          )
          return
        }
      }

      const result = await updateDraft(token.accessToken, draftId, draft)
      attachAccount(result, token.email)
      await appendDraftSnapshot(token.email, result.draft.gmail.draftId, {
        draft: result.draft,
        fingerprint: result.fingerprint,
        savedAt: new Date().toISOString(),
        source: 'update',
      })
      sendJson(response, result)
      return
    }

    sendJson(response, { error: 'API route not found.' }, 404)
  } catch (error) {
    sendJson(
      response,
      { error: error instanceof Error ? error.message : 'API request failed.' },
      error instanceof ApiError ? error.statusCode : 500,
    )
  }
}

async function handleGmailStatus(response) {
  const config = await readGoogleOAuthConfig()
  const token = await readTokenRecord()

  sendJson(response, {
    connected: Boolean(token?.refreshToken || token?.accessToken),
    email: token?.email,
    needsConfig: !config,
    scopes: token?.scopes ?? [],
  })
}

async function handleGmailConnect(response, origin, parsedUrl) {
  pruneOAuthSessions()
  const config = await readGoogleOAuthConfig()

  if (!config) {
    sendJson(
      response,
      {
        error:
          'Missing Google OAuth config. Set COPY_TO_GMAIL_GOOGLE_CLIENT_ID or COPY_TO_GMAIL_GOOGLE_OAUTH_CONFIG.',
      },
      400,
    )
    return
  }

  const scopes =
    parsedUrl.searchParams.get('scope') === 'signatures'
      ? signatureScopes
      : undefined
  const session = createOAuthStart({ config, origin, scopes })
  oauthSessions.set(session.state, {
    ...session,
    config,
    createdAt: Date.now(),
  })
  sendRedirect(response, session.url)
}

async function handleGmailCallback(response, parsedUrl) {
  const now = Date.now()
  pruneOAuthSessions(now)
  const state = parsedUrl.searchParams.get('state') ?? ''
  const code = parsedUrl.searchParams.get('code') ?? ''
  const session = oauthSessions.get(state)
  oauthSessions.delete(state)

  if (!session || !code || isOAuthSessionExpired(session, now)) {
    sendRedirect(response, '/?gmail=error')
    return
  }

  await exchangeOAuthCode({
    code,
    codeVerifier: session.codeVerifier,
    config: session.config,
    redirectUri: session.redirectUri,
  })
  sendRedirect(response, '/?gmail=connected')
}

async function requireGmailAccess() {
  const config = await readGoogleOAuthConfig()

  if (!config) {
    throw new Error('Google OAuth config is not available.')
  }

  const token = await getAccessToken(config)

  if (!token?.accessToken) {
    throw new Error('Gmail is not connected. Reconnect your account.')
  }

  return { config, token }
}

function attachAccount(result, accountEmail) {
  result.draft.gmail.accountEmail = accountEmail
}

function pruneOAuthSessions(now = Date.now()) {
  for (const [state, session] of oauthSessions) {
    if (isOAuthSessionExpired(session, now)) {
      oauthSessions.delete(state)
    }
  }
}

function isOAuthSessionExpired(session, now = Date.now()) {
  return (
    typeof session.createdAt !== 'number' ||
    now - session.createdAt > oauthSessionTtlMs
  )
}

function isWriteRequest(request) {
  return writeMethods.has(request.method ?? '')
}

function isExpectedLocalHost(request, host, port) {
  const expectedHost = `${host}:${port}`
  const requestHost = request.headers.host

  return requestHost === expectedHost
}

function isSameOriginWrite(request, origin) {
  return hasSameOriginProof(request, origin)
}

function isSameOriginNavigation(request, origin) {
  return hasSameOriginProof(request, origin, { allowDirectNavigation: true })
}

function hasSameOriginProof(
  request,
  origin,
  { allowDirectNavigation = false } = {},
) {
  const requestOrigin = request.headers.origin

  if (requestOrigin && requestOrigin !== origin) {
    return false
  }

  const fetchSiteHeader = request.headers['sec-fetch-site']
  const fetchSite = Array.isArray(fetchSiteHeader)
    ? fetchSiteHeader[0]?.toLowerCase()
    : fetchSiteHeader?.toLowerCase()

  if (fetchSite && fetchSite !== 'same-origin') {
    return allowDirectNavigation && fetchSite === 'none'
  }

  return requestOrigin === origin || fetchSite === 'same-origin'
}

function readJsonBody(request) {
  const contentTypeHeader = request.headers['content-type']
  const contentType = Array.isArray(contentTypeHeader)
    ? (contentTypeHeader[0] ?? '')
    : (contentTypeHeader ?? '')

  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return Promise.reject(
      new ApiError('Request body must be application/json.', 415),
    )
  }

  return new Promise((resolveBody, rejectBody) => {
    let raw = ''
    let bodyTooLarge = false
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      if (bodyTooLarge) {
        return
      }

      raw += chunk

      if (raw.length > 1_000_000) {
        bodyTooLarge = true
        rejectBody(new ApiError('Request body is too large.', 413))
        request.resume()
      }
    })
    request.on('end', () => {
      if (bodyTooLarge) {
        return
      }

      try {
        resolveBody(raw ? JSON.parse(raw) : {})
      } catch {
        rejectBody(new ApiError('Request body must be valid JSON.', 400))
      }
    })
    request.on('error', rejectBody)
  })
}

function decodeRequestPath(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    throw new ApiError('Request path is malformed.', 400)
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

class ApiError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
  }
}

function sendJson(response, value, statusCode = 200) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  setSecurityHeaders(response)
  response.end(JSON.stringify(value))
}

function sendRedirect(response, location) {
  response.statusCode = 302
  setSecurityHeaders(response)
  response.setHeader('Location', location)
  response.end()
}

function setSecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Content-Security-Policy', contentSecurityPolicy)
}

function parseArgs(argv) {
  const parsed = {
    help: false,
    host: defaultHost,
    open: true,
    port: undefined,
    version: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      parsed.help = true
    } else if (arg === '--version' || arg === '-v') {
      parsed.version = true
    } else if (arg === '--no-open') {
      parsed.open = false
    } else if (arg === '--port') {
      parsed.port = parsePort(argv[index + 1])
      index += 1
    } else if (arg.startsWith('--port=')) {
      parsed.port = parsePort(arg.slice('--port='.length))
    } else if (arg === '--host') {
      parsed.host = argv[index + 1] ?? defaultHost
      index += 1
    } else if (arg.startsWith('--host=')) {
      parsed.host = arg.slice('--host='.length)
    } else {
      console.error(`Unknown option: ${arg}`)
      printHelp()
      process.exit(1)
    }
  }

  return parsed
}

function parsePort(value) {
  const port = Number(value)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Invalid port: ${value}`)
    process.exit(1)
  }

  return port
}

async function findOpenPort() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = randomPort()

    if (await canListen(candidate)) {
      return candidate
    }
  }

  throw new Error('Unable to find an open high port.')
}

function randomPort() {
  const width = defaultPortRange.max - defaultPortRange.min
  return defaultPortRange.min + Math.floor(Math.random() * width)
}

function canListen(port) {
  return new Promise((resolveCanListen) => {
    const probe = net.createServer()
    probe.once('error', () => resolveCanListen(false))
    probe.once('listening', () => {
      probe.close(() => resolveCanListen(true))
    })
    probe.listen(port, defaultHost)
  })
}

function openBrowser(url) {
  const opener =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'cmd'
        : 'xdg-open'
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
  const child = spawn(opener, args, { detached: true, stdio: 'ignore' })
  child.unref()
}

async function readPackageVersion() {
  try {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
    return packageJson.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function printHelp() {
  console.log(`copy-to-gmail

Launch the local Copy to Gmail drafting studio from packaged assets.

Usage:
  copy-to-gmail [--port <port>] [--no-open]

Options:
  --port <port>  Bind to a specific local port.
  --host <host>  Must be 127.0.0.1. Other hosts are rejected.
  --no-open      Print the URL without opening a browser.
  --version      Print package version.
  --help         Show this help.
`)
}

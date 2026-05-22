import { readOptionalJsonFromEnvOrAppData } from './app-data.mjs'

export async function readGoogleOAuthConfig() {
  const fromEnv = {
    clientId:
      process.env.COPY_TO_GMAIL_GOOGLE_CLIENT_ID ??
      process.env.GOOGLE_CLIENT_ID,
    clientSecret:
      process.env.COPY_TO_GMAIL_GOOGLE_CLIENT_SECRET ??
      process.env.GOOGLE_CLIENT_SECRET,
  }

  if (fromEnv.clientId) {
    return fromEnv
  }

  const fileConfig = await readOptionalJsonFromEnvOrAppData(
    'COPY_TO_GMAIL_GOOGLE_OAUTH_CONFIG',
    'google-oauth.json',
  )

  if (!fileConfig || typeof fileConfig !== 'object') {
    return null
  }

  const clientId = fileConfig.clientId ?? fileConfig.client_id
  const clientSecret = fileConfig.clientSecret ?? fileConfig.client_secret

  return typeof clientId === 'string'
    ? { clientId, clientSecret: String(clientSecret ?? '') }
    : null
}

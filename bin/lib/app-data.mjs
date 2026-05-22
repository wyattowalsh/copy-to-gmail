import { constants } from 'node:fs'
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir, platform, tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

export function getAppDataDir() {
  if (process.env.COPY_TO_GMAIL_APP_DATA_DIR) {
    return process.env.COPY_TO_GMAIL_APP_DATA_DIR
  }

  if (platform() === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'copy-to-gmail')
  }

  if (platform() === 'win32') {
    return join(
      process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'),
      'copy-to-gmail',
    )
  }

  return join(
    process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'),
    'copy-to-gmail',
  )
}

export async function ensureAppDataDir(dir = getAppDataDir()) {
  await mkdir(dir, { mode: 0o700, recursive: true })
  return dir
}

export async function readJsonFile(filePath, fallback) {
  try {
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return fallback
    }

    throw error
  }
}

export async function writeJsonFile(filePath, value) {
  await mkdir(dirname(filePath), { mode: 0o700, recursive: true })
  const tempPath = join(
    dirname(filePath),
    `.${randomUUID()}.${process.pid}.tmp`,
  )
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  })
  await rename(tempPath, filePath)
}

export async function readOptionalJsonFromEnvOrAppData(envPath, fileName) {
  const explicitPath = process.env[envPath]

  if (explicitPath) {
    return readJsonFile(explicitPath, null)
  }

  const appDataPath = join(getAppDataDir(), fileName)

  try {
    await access(appDataPath, constants.R_OK)
  } catch {
    return null
  }

  return readJsonFile(appDataPath, null)
}

export async function appendDraftSnapshot(accountEmail, draftId, snapshot) {
  const safeAccount = accountEmail.replace(/[^a-z0-9._-]/gi, '_')
  const safeDraftId = draftId.replace(/[^a-z0-9._-]/gi, '_')
  const filePath = join(
    await ensureAppDataDir(),
    'snapshots',
    safeAccount,
    `${safeDraftId}.json`,
  )
  const current = await readJsonFile(filePath, { version: 1, snapshots: [] })
  const snapshots = Array.isArray(current.snapshots) ? current.snapshots : []
  const next = {
    version: 1,
    snapshots: [snapshot, ...snapshots].slice(0, 20),
  }
  await writeJsonFile(filePath, next)
  return next
}

export async function readLibraryBundle() {
  return readJsonFile(getLibraryPath(), {
    version: 1,
    signatures: [],
    templates: [],
    variableSets: [],
  })
}

export async function writeLibraryBundle(library) {
  const next = {
    version: 1,
    signatures: Array.isArray(library?.signatures) ? library.signatures : [],
    templates: Array.isArray(library?.templates) ? library.templates : [],
    variableSets: Array.isArray(library?.variableSets)
      ? library.variableSets
      : [],
  }
  await writeJsonFile(getLibraryPath(), next)
  return next
}

export function getFallbackTokenPath() {
  return join(getAppDataDir(), 'gmail-token.json')
}

function getLibraryPath() {
  return join(getAppDataDir(), 'library.json')
}

export function getTempDir() {
  return tmpdir()
}

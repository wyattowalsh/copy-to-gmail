import { chmod, rm } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { platform } from 'node:os'
import {
  getFallbackTokenPath,
  readJsonFile,
  writeJsonFile,
} from './app-data.mjs'

const execFileAsync = promisify(execFile)
const serviceName = 'copy-to-gmail.gmail'
const accountName = 'default'

export async function readTokenRecord() {
  if (platform() === 'darwin') {
    const record = await readKeychainTokenRecord()

    if (record) {
      return record
    }
  }

  return readJsonFile(getFallbackTokenPath(), null)
}

export async function writeTokenRecord(record) {
  if (platform() === 'darwin') {
    try {
      await writeKeychainTokenRecord(record)
      await rm(getFallbackTokenPath(), { force: true })
      return
    } catch {
      // Fall through to protected local file storage when Keychain is unavailable.
    }
  }

  await writeJsonFile(getFallbackTokenPath(), record)
  await chmod(getFallbackTokenPath(), 0o600)
}

export async function deleteTokenRecord() {
  if (platform() === 'darwin') {
    await execFileAsync('security', [
      'delete-generic-password',
      '-s',
      serviceName,
      '-a',
      accountName,
    ]).catch(() => undefined)
  }

  await rm(getFallbackTokenPath(), { force: true })
}

async function readKeychainTokenRecord() {
  try {
    const { stdout } = await execFileAsync('security', [
      'find-generic-password',
      '-s',
      serviceName,
      '-a',
      accountName,
      '-w',
    ])
    return JSON.parse(stdout.trim())
  } catch {
    return null
  }
}

async function writeKeychainTokenRecord(record) {
  await execFileAsync('security', [
    'add-generic-password',
    '-U',
    '-s',
    serviceName,
    '-a',
    accountName,
    '-w',
    JSON.stringify(record),
  ])
}

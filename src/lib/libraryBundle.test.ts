import { describe, expect, it } from 'vitest'

import {
  createEmptyLibrary,
  mergeLibraryBundles,
  parseLibraryBundle,
  serializeLibraryBundle,
} from './libraryBundle'

describe('library bundles', () => {
  it('round-trips templates, signatures, and variable sets without credentials', () => {
    const bundle = parseLibraryBundle({
      version: 1,
      signatures: [
        {
          html: '<p>Regards</p><script>alert(1)</script>',
          id: 'sig_1',
          name: 'Regards',
          refreshToken: 'secret',
          source: 'local',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      templates: [
        {
          html: '<p>Hello</p>',
          id: 'tpl_1',
          name: 'Hello',
          recipients: { to: 'a@example.com' },
          subject: 'Hi',
          updatedAt: '2026-01-01T00:00:00.000Z',
          variables: [],
        },
      ],
      variableSets: [
        {
          id: 'vars_1',
          name: 'Ada',
          updatedAt: '2026-01-01T00:00:00.000Z',
          values: { first_name: 'Ada', nested: { ignored: true } },
        },
      ],
    })

    const serialized = serializeLibraryBundle(bundle)

    expect(serialized).not.toContain('refreshToken')
    expect(serialized).not.toContain('<script')
    expect(parseLibraryBundle(JSON.parse(serialized))).toEqual(bundle)
  })

  it('merges imported records by id', () => {
    const current = createEmptyLibrary()
    const incoming = parseLibraryBundle({
      signatures: [{ html: '<p>A</p>', id: 'sig_1', name: 'A' }],
    })

    expect(mergeLibraryBundles(current, incoming).signatures).toHaveLength(1)
  })
})

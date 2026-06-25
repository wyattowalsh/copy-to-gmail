import {
  handleCreateDraft,
  handleError,
  handleListDrafts,
  handleOptions,
  methodNotAllowed,
} from '../../../api-lib/hosted-gmail.mjs'

export async function GET(request) {
  try {
    return await handleListDrafts(request)
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(request) {
  try {
    return await handleCreateDraft(request)
  } catch (error) {
    return handleError(error)
  }
}

export function OPTIONS() {
  return handleOptions()
}

export function PUT() {
  return methodNotAllowed()
}

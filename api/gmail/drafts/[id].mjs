import {
  handleError,
  handleGetDraft,
  handleOptions,
  handleUpdateDraft,
  methodNotAllowed,
} from '../../../api-lib/hosted-gmail.mjs'

export async function GET(request, context) {
  try {
    return await handleGetDraft(request, getDraftId(request, context))
  } catch (error) {
    return handleError(error)
  }
}

export async function PUT(request, context) {
  try {
    return await handleUpdateDraft(request, getDraftId(request, context))
  } catch (error) {
    return handleError(error)
  }
}

export function OPTIONS() {
  return handleOptions()
}

export function POST() {
  return methodNotAllowed()
}

function getDraftId(request, context) {
  const raw =
    context?.params?.id ??
    new URL(request.url).pathname.split('/').filter(Boolean).at(-1) ??
    ''
  return decodeURIComponent(raw)
}

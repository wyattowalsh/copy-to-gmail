import {
  handleError,
  handleOptions,
  handleSignatures,
  methodNotAllowed,
} from '../../api-lib/hosted-gmail.mjs'

export async function GET(request) {
  try {
    return await handleSignatures(request)
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

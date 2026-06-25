import {
  handleDisconnect,
  handleError,
  handleOptions,
  methodNotAllowed,
} from '../../api-lib/hosted-gmail.mjs'

export async function POST(request) {
  try {
    return await handleDisconnect(request)
  } catch (error) {
    return handleError(error)
  }
}

export function OPTIONS() {
  return handleOptions()
}

export function GET() {
  return methodNotAllowed()
}

import {
  handleError,
  handleLibraryGet,
  handleLibraryPut,
  handleOptions,
  methodNotAllowed,
} from '../api-lib/hosted-gmail.mjs'

export function GET() {
  try {
    return handleLibraryGet()
  } catch (error) {
    return handleError(error)
  }
}

export async function PUT(request) {
  try {
    return await handleLibraryPut(request)
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

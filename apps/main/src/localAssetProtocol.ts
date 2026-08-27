import fs from 'node:fs/promises'
import path from 'node:path'
import { protocol } from 'electron'
import { LOCAL_ASSET_PATH_QUERY, LOCAL_ASSET_PROTOCOL } from '@vide/config'

let schemeRegistered = false
let handlerInstalled = false

export function registerLocalAssetProtocolScheme() {
  if (schemeRegistered) return

  protocol.registerSchemesAsPrivileged([
    {
      scheme: LOCAL_ASSET_PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ])

  schemeRegistered = true
}

export function installLocalAssetProtocol() {
  if (handlerInstalled) return

  protocol.handle(LOCAL_ASSET_PROTOCOL, async (request) => {
    const filePath = getLocalAssetPath(request.url)

    if (!filePath) {
      return createTextResponse(400, 'Missing local asset path.')
    }

    if (!path.isAbsolute(filePath)) {
      return createTextResponse(400, 'Local asset path must be absolute.')
    }

    const resolvedPath = path.normalize(filePath)

    try {
      const stat = await fs.stat(resolvedPath)
      if (!stat.isFile()) {
        return createTextResponse(404, 'Local asset file was not found.')
      }
    } catch {
      return createTextResponse(404, 'Local asset file was not found.')
    }

    const data = await fs.readFile(resolvedPath)

    return new Response(data, {
      status: 200,
      headers: {
        'cache-control': 'no-store',
        'content-length': String(data.byteLength),
        'content-type': getMimeType(resolvedPath),
      },
    })
  })

  handlerInstalled = true
}

function getLocalAssetPath(requestUrl: string) {
  const url = new URL(requestUrl)
  return url.searchParams.get(LOCAL_ASSET_PATH_QUERY)
}

function createTextResponse(status: number, message: string) {
  return new Response(message, {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
    },
  })
}

function getMimeType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()

  switch (extension) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.bmp':
      return 'image/bmp'
    case '.svg':
      return 'image/svg+xml'
    case '.ico':
      return 'image/x-icon'
    case '.tiff':
      return 'image/tiff'
    case '.avif':
      return 'image/avif'
    case '.mp4':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    case '.mov':
      return 'video/quicktime'
    case '.mkv':
      return 'video/x-matroska'
    case '.avi':
      return 'video/x-msvideo'
    case '.m4v':
      return 'video/x-m4v'
    case '.mpeg':
    case '.mpg':
      return 'video/mpeg'
    case '.wmv':
      return 'video/x-ms-wmv'
    default:
      return 'application/octet-stream'
  }
}

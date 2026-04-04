/**
 * Minimal static file server used by Playwright and local fixture rendering.
 *
 * It serves the current workspace root, exposes a cheap health endpoint for
 * readiness checks, and blocks path traversal outside the repo root.
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'

const host = process.env.HOST ?? '127.0.0.1'
const port = Number(process.env.PLAYWRIGHT_TEST_PORT ?? process.env.PORT ?? 3000)
const root = resolve(process.cwd())

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

/**
 * Resolve a request path to a filesystem path under the repo root.
 */
function toFsPath(urlPath) {
  const pathname = decodeURIComponent(urlPath.split('?')[0] || '/')
  const relativePath = pathname === '/' ? '/index.html' : pathname
  const resolved = resolve(root, `.${relativePath}`)
  const rootPrefix = `${root}${sep}`

  if (resolved !== root && !resolved.startsWith(rootPrefix)) {
    return null
  }

  return resolved
}

/**
 * Resolve a requested path to a file, supporting directory index files.
 */
async function resolveFile(filePath) {
  try {
    const fileStat = await stat(filePath)
    if (fileStat.isDirectory()) {
      const indexPath = join(filePath, 'index.html')
      const indexStat = await stat(indexPath)
      return indexStat.isFile() ? indexPath : null
    }

    return fileStat.isFile() ? filePath : null
  } catch {
    return null
  }
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end('Bad Request')
    return
  }

  if (req.url === '/_health') {
    res.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    }).end('ok')
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method Not Allowed')
    return
  }

  const requestedPath = toFsPath(req.url)
  if (!requestedPath) {
    res.writeHead(403).end('Forbidden')
    return
  }

  const filePath = await resolveFile(requestedPath)
  if (!filePath) {
    res.writeHead(404).end('Not Found')
    return
  }

  try {
    const body = await readFile(filePath)
    const type = mimeTypes[extname(filePath)] ?? 'application/octet-stream'

    res.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': body.length,
      'Content-Type': type,
    })

    if (req.method === 'HEAD') {
      res.end()
      return
    }

    res.end(body)
  } catch {
    res.writeHead(500).end('Internal Server Error')
  }
})

/**
 * Gracefully stop the server when the process receives a termination signal.
 */
function shutdown(signal) {
  server.close(() => {
    process.exit(signal === 'SIGINT' ? 130 : 0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

server.on('error', (error) => {
  console.error(error)
  process.exit(1)
})

server.listen(port, host, () => {
  console.log(`Serving ${root} at http://${host}:${port}`)
})

import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT || 4173)

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
}

function send(res, statusCode, body, contentType) {
  res.writeHead(statusCode, {
    'content-type': contentType || 'text/plain; charset=utf-8',
    'cache-control': 'no-cache, no-store, must-revalidate',
    'pragma': 'no-cache',
    'expires': '0'
  })
  res.end(body)
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://${host}:${port}`)
    let pathname = decodeURIComponent(requestUrl.pathname)
    if (pathname === '/') {
      pathname = '/web/index.html'
    }

    const filePath = path.resolve(rootDir, '.' + pathname)
    if (!filePath.startsWith(rootDir)) {
      send(res, 403, 'Forbidden')
      return
    }

    const fileStat = await stat(filePath)
    if (fileStat.isDirectory()) {
      send(res, 403, 'Directory listing disabled')
      return
    }

    const body = await readFile(filePath)
    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
    send(res, 200, body, contentType)
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      send(res, 404, 'Not found')
      return
    }
    send(res, 500, String(error && error.message ? error.message : error))
  }
})

server.listen(port, host, () => {
  console.log(`Lua Painter harness listening on http://${host}:${port}/web/index.html`)
})

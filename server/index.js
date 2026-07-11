import path from 'node:path'
import { fileURLToPath } from 'node:url'
import expressStaticGzip from 'express-static-gzip'
import { createApp } from './app.js'

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const app = createApp()

// Hashed bundles under /assets never change; everything else must revalidate
function setCacheHeaders(res, filePath) {
  if (filePath.split(/[\\/]/).includes('assets')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  } else {
    res.setHeader('Cache-Control', 'no-cache')
  }
}

app.use(
  expressStaticGzip(dist, {
    enableBrotli: true,
    orderPreference: ['br'],
    serveStatic: { setHeaders: setCacheHeaders },
  }),
)

// SPA fallback for any non-API, non-file GET
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/') || path.extname(req.path)) return next()
  res.set('Cache-Control', 'no-cache')
  res.sendFile(path.join(dist, 'index.html'))
})

const port = Number(process.env.PORT) || 8080
app.listen(port, () => {
  console.log(`onoma listening on :${port}`)
})

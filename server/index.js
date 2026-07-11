import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createApp } from './app.js'

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const app = createApp()

app.use(express.static(dist))
// SPA fallback for any non-API GET
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(dist, 'index.html'))
})

const port = Number(process.env.PORT) || 8080
app.listen(port, () => {
  console.log(`onoma listening on :${port}`)
})

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, gzipSync, constants } from 'node:zlib'

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const TEXT_EXTENSIONS = new Set(['.js', '.css', '.svg', '.html', '.txt', '.json'])
// below ~1KB compression saves nothing once headers are counted
const MIN_BYTES = 1024

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else yield full
  }
}

let count = 0
for (const file of walk(dist)) {
  if (!TEXT_EXTENSIONS.has(path.extname(file))) continue
  const source = readFileSync(file)
  if (source.length < MIN_BYTES) continue
  writeFileSync(
    `${file}.br`,
    brotliCompressSync(source, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
        [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
      },
    }),
  )
  writeFileSync(`${file}.gz`, gzipSync(source, { level: constants.Z_BEST_COMPRESSION }))
  count += 1
}
console.log(`precompress: wrote .br/.gz for ${count} file(s)`)

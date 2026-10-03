import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createClient } from 'hafas-client'
import { profile } from 'hafas-client/p/vbn/index.js'
import puppeteer, { type Browser } from 'puppeteer'
import { selectRows } from './board.ts'

const PORT = Number(process.env.PORT ?? 3000)
const CACHE_MS = 45_000
const STALE_MS = 10 * 60_000
const NIGHT = { from: 0, to: 5 } // hours, Europe/Berlin (set TZ)
const W = 800, H = 480

const hafas = createClient(profile, 'haltestellenanzeige')
const pub = new URL('../public/', import.meta.url)

// ponytail: in-memory cache per stop, unbounded; fine for a handful of displays.
const cache = new Map<string, { at: number; name: string; deps: any[] }>()

async function departures(stop: string) {
  const hit = cache.get(stop)
  if (hit && Date.now() - hit.at < CACHE_MS) return { ...hit, stale: false }
  try {
    const [res, loc] = await Promise.all([
      hafas.departures(stop, { duration: 90, remarks: false }),
      hit ? { name: hit.name } : hafas.stop(stop),
    ])
    const entry = { at: Date.now(), name: (loc as any).name.replace(/^Bremen\s+/, ''), deps: res.departures }
    cache.set(stop, entry)
    return { ...entry, stale: false }
  } catch (e) {
    console.error('hafas', stop, (e as Error).message)
    if (hit && Date.now() - hit.at < STALE_MS) return { ...hit, stale: true }
    throw e
  }
}

const list = (v: string | null) => (v ?? '').split(',').map(s => s.trim()).filter(Boolean)

async function boardJson(q: URLSearchParams) {
  const stop = q.get('stop')
  if (!stop || !/^\d+$/.test(stop)) throw Object.assign(new Error('stop fehlt'), { status: 400 })
  const d = await departures(stop)
  const rows = selectRows(d.deps, Date.now(), {
    offset: Math.max(0, Number(q.get('offset')) || 0),
    lines: list(q.get('lines')),
    dirs: list(q.get('dir')),
    max: 6,
  })
  return { name: d.name, updatedAt: new Date(d.at).toISOString(), stale: d.stale, rows }
}

let browser: Promise<Browser> | undefined
// --disable-lcd-text: no coloured subpixel fringes, which would turn into red specks on e-ink
const getBrowser = () => (browser ??= puppeteer.launch({ args: ['--no-sandbox', '--disable-lcd-text'] }))

// Screenshot the board in e-ink mode, then split pixels into black and red bitplanes
// (800x480, MSB first, 1 = ink). The canvas in the page does the PNG decoding for us.
async function boardBin(query: string) {
  const page = await (await getBrowser()).newPage()
  try {
    await page.setViewport({ width: W, height: H })
    await page.goto(`http://127.0.0.1:${PORT}/board?${query}&eink=1`)
    await page.waitForSelector('body[data-ready]', { timeout: 15_000 })
    const png = await page.screenshot({ encoding: 'base64' })
    const planes: number[] = await page.evaluate(async (b64, w, h) => {
      const img = new Image()
      img.src = 'data:image/png;base64,' + b64
      await img.decode()
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const px = ctx.getImageData(0, 0, w, h).data
      const out = new Array(w * h / 4).fill(0) // black plane, then red plane
      for (let i = 0; i < w * h; i++) {
        const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2]
        const bit = 0x80 >> (i & 7), byte = i >> 3
        if (r > 140 && g < 110 && b < 110) out[w * h / 8 + byte] |= bit
        else if (0.3 * r + 0.59 * g + 0.11 * b < 128) out[byte] |= bit
      }
      return out
    }, png, W, H)
    return Buffer.from(planes)
  } finally {
    await page.close()
  }
}

// Seconds the ESP should wait before the next poll: 60, or until the night pause ends.
function sleepSeconds(now = new Date()) {
  const h = now.getHours()
  if (h < NIGHT.from || h >= NIGHT.to) return 60
  const wake = new Date(now); wake.setHours(NIGHT.to, 0, 0, 0)
  return Math.ceil((wake.getTime() - now.getTime()) / 1000)
}

createServer(async (req, res) => {
  const url = new URL(req.url!, 'http://x')
  try {
    switch (url.pathname) {
      case '/':
      case '/board': {
        const file = url.pathname === '/' ? 'index.html' : 'board.html'
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        return res.end(await readFile(new URL(file, pub)))
      }
      case '/api/stops': {
        const q = url.searchParams.get('q') ?? ''
        const locs = q.length < 2 ? [] : await hafas.locations(q, { results: 10, addresses: false, poi: false })
        res.writeHead(200, { 'content-type': 'application/json' })
        return res.end(JSON.stringify(locs.map((l: any) => ({ id: l.id, name: l.name }))))
      }
      case '/api/board': {
        const body = JSON.stringify(await boardJson(url.searchParams))
        res.writeHead(200, { 'content-type': 'application/json' })
        return res.end(body)
      }
      case '/board.bin': {
        const sleep = String(sleepSeconds())
        if (sleep !== '60') { // night pause: don't render, tell the ESP to keep the old image
          res.writeHead(304, { 'x-sleep': sleep })
          return res.end()
        }
        const buf = await boardBin(url.searchParams.toString())
        const etag = '"' + createHash('sha1').update(buf).digest('hex') + '"'
        if (req.headers['if-none-match'] === etag) {
          res.writeHead(304, { etag, 'x-sleep': sleep })
          return res.end()
        }
        res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': buf.length, etag, 'x-sleep': sleep })
        return res.end(buf)
      }
    }
    res.writeHead(404).end('not found')
  } catch (e: any) {
    console.error(url.pathname, e.message)
    if (!res.headersSent) res.writeHead(e.status ?? 503, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(e.message)
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`))

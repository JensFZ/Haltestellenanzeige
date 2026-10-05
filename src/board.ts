// Pure board logic: HAFAS departures -> rows to display. No I/O here.

export type Row = {
  line: string
  tram: boolean
  direction: string
  platform: string | null
  time: string // planned departure, ISO
  delayMin: number | null
  cancelled: boolean
  leaveInMin: number // minutes until you have to leave (offset already subtracted)
}

export type Options = { offset: number; lines: string[]; dirs: string[]; max: number; mode?: 'tram' | 'bus' }

// HAFAS/VBN tags trams as "dial-a-ride", so the name prefix ("Tram 4", "Bus 26") is the reliable source.
export function toRow(d: any, now: number, offset: number): Row {
  const name: string = d.line?.name ?? '?'
  const when = Date.parse(d.when ?? d.plannedWhen)
  return {
    line: name.replace(/^(Tram|Bus|STR|RUF)\s+/i, ''),
    tram: /^(Tram|STR)\b/i.test(name),
    direction: d.direction ?? '',
    platform: d.platform ?? d.plannedPlatform ?? null,
    time: d.plannedWhen ?? d.when,
    delayMin: d.delay == null ? null : Math.round(d.delay / 60),
    cancelled: !!d.cancelled,
    leaveInMin: Math.floor((when - now) / 60000) - offset,
  }
}

export function selectRows(departures: any[], now: number, o: Options): Row[] {
  const lines = o.lines.map(l => l.toLowerCase())
  const dirs = o.dirs.map(d => d.toLowerCase())
  return departures
    .map(d => toRow(d, now, o.offset))
    .filter(r => r.leaveInMin >= 0)
    .filter(r => !o.mode || r.tram === (o.mode === 'tram'))
    .filter(r => !lines.length || lines.includes(r.line.toLowerCase()))
    .filter(r => !dirs.length || dirs.some(d => r.direction.toLowerCase().includes(d)))
    .sort((a, b) => a.leaveInMin - b.leaveInMin)
    .slice(0, o.max)
}

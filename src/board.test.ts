import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selectRows } from './board.ts'

const now = Date.parse('2026-10-03T22:40:00+02:00')
const dep = (name: string, when: string, direction: string, extra = {}) =>
  ({ line: { name }, when: `2026-10-03T${when}:00+02:00`, plannedWhen: `2026-10-03T${when}:00+02:00`, direction, delay: 0, ...extra })

test('offset, filters, sorting, cancelled', () => {
  const deps = [
    dep('Bus 26', '22:49', 'Überseestadt'),
    dep('Tram 4', '22:43', 'Arsten'), // only 3 min away -> unreachable with offset 5
    dep('Tram 4', '22:47', 'Lilienthal'),
    dep('Tram 6', '22:46', 'Universität', { cancelled: true, when: null }),
  ]
  const rows = selectRows(deps, now, { offset: 5, lines: [], dirs: [], max: 6 })
  assert.deepEqual(rows.map(r => [r.line, r.leaveInMin, r.tram]), [['6', 1, true], ['4', 2, true], ['26', 4, false]])
  assert.equal(rows[0].cancelled, true)

  assert.deepEqual(selectRows(deps, now, { offset: 5, lines: ['26'], dirs: [], max: 6 }).map(r => r.line), ['26'])
  assert.deepEqual(selectRows(deps, now, { offset: 0, lines: [], dirs: ['lilien'], max: 6 }).map(r => r.direction), ['Lilienthal'])
  assert.equal(selectRows(deps, now, { offset: 0, lines: [], dirs: [], max: 2 }).length, 2)
  assert.deepEqual(selectRows(deps, now, { offset: 0, lines: [], dirs: [], max: 6, mode: 'bus' }).map(r => r.line), ['26'])
  assert.deepEqual(selectRows(deps, now, { offset: 0, lines: [], dirs: [], max: 6, mode: 'tram' }).map(r => r.line), ['4', '6', '4'])
})

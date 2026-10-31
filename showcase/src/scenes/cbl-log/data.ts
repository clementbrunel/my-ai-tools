// Fake log data and texts of the cbl-log demo (LiveTail.tsx).

export type Level = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'
export const LEVELS: Level[] = ['ERROR', 'WARN', 'INFO', 'DEBUG']

/** One log record; `n` is its line number in the file, its stack trace lines follow it. */
export interface Entry { id: number; n: number; time: string; level: Level; msg: string; stack?: string[] }

/** [level, message, weight, stack trace]. `user=…` tokens are highlighted by the default profile. */
type Pool = [Level, string, number, string[]?][]

const appPool: Pool = [
  ['INFO', 'GET /api/orders 200 · 38 ms', 5],
  ['INFO', 'login ok user=alice', 3],
  ['DEBUG', 'cache hit ratio 0.93', 3],
  ['INFO', 'ws client connected user=dave', 2],
  ['INFO', 'nightly-export done · 12 480 rows', 2],
  ['WARN', 'pool: slow connection (812 ms) user=bob', 2],
  ['WARN', 'http 429 rate limited user=carol', 2],
  ['ERROR', 'db timeout on GET /api/orders/42', 1, [
    'java.sql.SQLTimeoutException: query timed out after 5000 ms',
    '  at com.zaxxer.hikari.pool.ProxyStatement.executeQuery(ProxyStatement.java:110)',
    '  at com.shop.repo.OrderRepository.find(OrderRepository.java:57)',
    '  at com.shop.service.OrderService.get(OrderService.java:42)',
    '  at com.shop.api.OrderController.show(OrderController.java:31)',
  ]],
  ['ERROR', 'unhandled exception on POST /api/orders user=erin', 1, [
    'java.lang.NullPointerException: customer is null',
    '  at com.shop.service.OrderService.save(OrderService.java:118)',
    '  at com.shop.api.OrderController.create(OrderController.java:64)',
    '  at org.springframework.web.servlet.FrameworkServlet.service(FrameworkServlet.java:897)',
    '  at jakarta.servlet.http.HttpServlet.service(HttpServlet.java:614)',
    '  ... 48 more',
  ]],
]

/** Second tab: a server that writes less often, so its unseen-lines badge is easy to follow. */
const serverPool: Pool = [
  ['INFO', 'GET /health 200 · 2 ms', 4],
  ['INFO', 'POST /api/payments 201 · 112 ms user=frank', 3],
  ['DEBUG', 'gc pause 14 ms', 2],
  ['WARN', 'disk usage 87 % on /var/log', 1],
  ['ERROR', 'payment gateway unreachable user=grace', 1, [
    'java.net.ConnectException: Connection refused',
    '  at java.base/sun.nio.ch.Net.connect(Net.java:579)',
    '  at com.shop.pay.GatewayClient.charge(GatewayClient.java:73)',
    '  at com.shop.pay.PaymentService.pay(PaymentService.java:40)',
  ]],
]

/** The tabs: pool, first line number, lines shown on load (indexes into the pool), write period in ms. Add one here to add a tab. */
export const TABS = {
  app: { name: 'app.log', pool: appPool, first: 1281, seed: [0, 1, 2, 5, 0, 4, 1, 7, 3, 6, 0], every: 900 },
  server: { name: 'server.log', pool: serverPool, first: 5402, seed: [0, 1, 0, 2, 0, 3, 1, 4, 0, 0, 1], every: 1400 },
}
export type TabId = keyof typeof TABS
export const TAB_IDS = Object.keys(TABS) as TabId[]

/** Entries kept per tab (older ones are dropped). */
export const KEEP = 150

let uid = 0
const make = (p: Pool[number], n: number, time: string): Entry => ({ id: uid++, n, time, level: p[0], msg: p[1], stack: p[3] })
/** Next file line number: an entry with a stack trace uses one line per stack line too. */
export const nextLine = (e: Entry) => e.n + 1 + (e.stack?.length ?? 0)

const clock = (ago = 0) => {
  const d = new Date(Date.now() - ago)
  const z = (v: number, l = 2) => String(v).padStart(l, '0')
  return `${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}.${z(d.getMilliseconds(), 3)}`
}

const pick = (pool: Pool) => {
  let r = Math.random() * pool.reduce((s, p) => s + p[2], 0)
  for (const p of pool) if ((r -= p[2]) < 0) return p
  return pool[0]
}

/** Lines already in the file when the scene appears, timestamped as if written at the tab's pace. */
export function seedStream(id: TabId): Entry[] {
  const { pool, first, seed, every } = TABS[id]
  const out: Entry[] = []
  seed.forEach((i, k) => out.push(make(pool[i], out.length ? nextLine(out[out.length - 1]) : first, clock((seed.length - k) * every))))
  return out
}

/** The stream with one new random line written now. */
export const writeLine = (id: TabId, stream: Entry[]): Entry[] =>
  [...stream, make(pick(TABS[id].pool), nextLine(stream[stream.length - 1]), clock())].slice(-KEEP)

export const txt = {
  fr: { levels: 'Niveaux affichés', filter: 'Filtrer (Ctrl+Maj+F)', include: 'Inclure (Entrée)', regex: 'Expression régulière', remove: 'Retirer', fold: 'Replier les traces', lines: (n: number) => `ligne${n > 1 ? 's' : ''}`, of: 'sur', pause: 'Pause', follow: 'Suivre', hint: 'Décoche un niveau, filtre un texte, déplie une trace, remonte dans le log.' },
  en: { levels: 'Levels shown', filter: 'Filter (Ctrl+Shift+F)', include: 'Include (Enter)', regex: 'Regular expression', remove: 'Remove', fold: 'Fold traces', lines: (n: number) => `line${n > 1 ? 's' : ''}`, of: 'of', pause: 'Pause', follow: 'Follow', hint: 'Untick a level, filter a text, unfold a trace, scroll up the log.' },
}
export type Texts = (typeof txt)['fr']

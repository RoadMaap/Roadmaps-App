"use client";
import { useId, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { AxisTag, ChartCard } from "@/components/ui/chart-overlay"
import { SegmentedControl } from "@/components/ui/segmented-control"

/* Total Balance, promoted from a lab sketch through ssych-component (2026-09-29).
   What it is for: the whole account as one line over a chosen window, with the three
   figures a holder asks of it: how far it fell at worst, how steady it was, what it
   returned.
   Read first: the balance, the one large figure.
   The pointer: scrubbing the chart puts that point's balance and its time where the
   headline is, so nothing floats over the line; the pills slide a fill to the chosen
   window and the line tweens to it.
   Sketch used: src/components/lab/TotalBalanceCard.tsx. Kept: the seeded multiplicative
   walk per window, the readout as plain text that never covers the plot, the right-edge
   price ticks, the three figures worked from the series. Changed: no card, no hatched
   ground and no amber wash, a fall is red (it was amber), the readout takes the headline's
   place (it was a chip riding a band above the plot), the window switcher is a row of
   pills, the two icon buttons that did nothing are gone, the formulas moved from under
   each figure to this comment, and it is 480 wide where the sketch was 820.
   Sample data fixed: the sketch read every window with a 24-hour clock, so a point a week
   back showed a time of day; each window now reads in its own unit.
   2026-10-02 audit: too many numbers (his call). The row of three figures under the plot is
   gone, and with it the total return printed twice and "Steadiness", an index of our own
   making. What is left is one header in three tiers (spec 14.1): the title at /45 with the
   window switch on the right (the shared SegmentedControl, moved up from under the plot),
   the balance at 26px with its cents at /35, then the change and the return once, in their
   hue, with the window at /45. The pointed point reads in the shared ChartCard (time,
   balance, change from the window's open, drawdown there) with the balance tagged on the
   axis by AxisTag, and the line past the pointer dims to 0.45; the header no longer swaps.
   The max drawdown moved to the aria-label. 460 wide, the Balance family's width.
   Formulas:
   · change         last (or the pointed value) − first of the window
   · total return   (last − first) ÷ first × 100
   · drawdown       (value − highest value so far) ÷ highest value so far × 100
   · max drawdown   the lowest drawdown in the window (read in the aria-label)
   Motion (2026-10-01): the line and its area sweep in from the left once the chart is a third
   in view (one clip, 900ms); a new window tweens the line and the area to the new walk
   (400ms) where they drew again, and the price ticks fade to their new figures; reduced
   motion shows each state at once. */

const EASE = [0.16, 1, 0.3, 1]
const GREEN = "var(--chart-up)"
const RED = "var(--chart-down)"
/** A hue as text: its lightness is capped in the light theme so small figures stay readable. */
const ink = (c) => `oklch(from ${c} min(l, var(--ink-l, 1)) c h)`

const N = 150
/** every sample window opens on this one number */
const OPEN = 12_480

/** a seeded walk whose steps are a share of the balance, so a window moves a few percent */
function walk(seed, drift) {
  let s = seed
  let v = OPEN
  const out = []
  for (let i = 0; i < N; i++) {
    s = (s * 48271) % 2147483647
    v *= 1 + (s / 2147483647 - 0.5) * 0.0065 + drift
    out.push(v)
  }
  return out
}

const DEFAULT_WINDOWS = [
  { key: "24h", label: "24h", series: walk(9, -0.00012), length: 24, unit: "clock" },
  { key: "1w", label: "1w", series: walk(37, -0.00028), length: 7, unit: "d" },
  { key: "1m", label: "1m", series: walk(71, 0.00019), length: 30, unit: "d" },
  { key: "all", label: "All", series: walk(113, 0.00042), length: 52, unit: "w" },
]

const W = 460
const H = 190
/** r is the gutter the price ticks live in; l keeps the first round cap inside the box */
const PAD = { t: 10, b: 10, l: 4, r: 52 }
const PLOT = W - PAD.l - PAD.r

const usd = (v, dp = 2) => `$${v.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`
const signedPct = (v) => `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(2)}%`

/** the walk through every point, always written with `m` vertices (a shorter window repeats
 *  its points), so a new window tweens the path instead of redrawing it */
function linePath(vals, m, px, py) {
  const n = vals.length
  let d = ""
  for (let k = 0; k < m; k++) {
    const i = m > 1 && n > 1 ? Math.round((k * (n - 1)) / (m - 1)) : 0
    d += `${k ? " L" : "M"}${px(i).toFixed(1)},${py(vals[i]).toFixed(1)}`
  }
  return d
}

/** what the window spans, in words */
function span(w) {
  if (w.unit === "seconds") {
    const seconds = Math.max(1, Math.round(w.length))
    if (seconds < 60) return `past ${seconds} second${seconds === 1 ? "" : "s"}`
    const minutes = Math.round(seconds / 60)
    return `past ${minutes} minute${minutes === 1 ? "" : "s"}`
  }
  const unit = w.unit === "clock" ? "hour" : w.unit === "d" ? "day" : "week"
  return `past ${w.length} ${unit}${w.length === 1 ? "" : "s"}`
}

/** where a point sits in time, in the window's own unit */
function when(w, i) {
  const t = w.series.length > 1 ? i / (w.series.length - 1) : 1
  if (w.unit === "seconds") {
    const ago = Math.round((1 - t) * w.length)
    return ago === 0 ? "now" : `${ago}s ago`
  }
  if (w.unit === "clock") {
    const m = Math.round(t * (w.length * 60 - 1))
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
  }
  const ago = Math.round((1 - t) * w.length)
  return ago === 0 ? "now" : `${ago}${w.unit} ago`
}

/**
 * The account as one scrubbable line: the balance, its change and return over the chosen
 * window on top, the window switch in the label row, and the pointed point read in a card.
 */
export function TotalBalance({
  title = "Total balance",
  windows = DEFAULT_WINDOWS,
  defaultRange = "24h",
  showRangeControl = true,
  currentValue,
  className
}) {
  const reduced = useReducedMotion()
  const uid = useId().replace(/:/g, "")
  const boxRef = useRef(null)
  /* the sweep waits until the chart is a third in view, then plays once */
  const play = useInView(boxRef, { once: true, amount: 0.3 }) || !!reduced
  const tween = reduced ? { duration: 0 } : { duration: 0.4, ease: EASE }
  const [range, setRange] = useState(defaultRange)
  const [hi, setHi] = useState(null)

  const win = windows.find((w) => w.key === range) ?? windows[0] ?? DEFAULT_WINDOWS[0]
  const data = win.series.length ? win.series : [0]
  const n = data.length
  /** one vertex count for every window */
  const m = Math.min(500, Math.max(1, ...windows.map((w) => w.series.length)))

  const geo = useMemo(() => {
    const rawRange = data.reduce((range, value) => ({
      lo: Math.min(range.lo, value),
      top: Math.max(range.top, value),
    }), { lo: Infinity, top: -Infinity })
    const flatPadding = rawRange.top === rawRange.lo
      ? Math.max(Math.abs(currentValue ?? rawRange.top) * 0.01, 1)
      : 0
    const lo = rawRange.lo - flatPadding
    const top = rawRange.top + flatPadding
    const span = top - lo || 1
    const x = (i) => PAD.l + (i / Math.max(1, n - 1)) * PLOT
    const y = (v) => PAD.t + (1 - (v - lo) / span) * (H - PAD.t - PAD.b)
    const d = linePath(data, m, x, y)
    return { x, y, lo, top, span, d, area: `${d} L${x(n - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z` }
  }, [data, n, m])

  const stats = useMemo(() => {
    const first = data[0]
    const last = Number.isFinite(currentValue) ? currentValue : data[n - 1]
    let peak = first
    let drawdown = 0
    for (const v of data) {
      if (v > peak) peak = v
      drawdown = Math.min(drawdown, peak ? ((v - peak) / peak) * 100 : 0)
    }
    return {
      last,
      change: last - first,
      totalReturn: first ? ((last - first) / first) * 100 : 0,
      drawdown,
    }
  }, [data, n, currentValue])

  const onMove = (e) => {
    const el = boxRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    setHi(Math.max(0, Math.min(n - 1, Math.round(((x - PAD.l) / PLOT) * (n - 1)))))
  }

  const at = hi ?? n - 1
  const hueOf = (v) => ink(v >= 0 ? GREEN : RED)
  const [whole, cents] = usd(stats.last).split(".")
  /* the pointed point: its change from the window's open, and its drawdown from the peak before it */
  const pointed = useMemo(() => {
    if (hi === null) return null
    let peak = data[0]
    for (let i = 0; i <= hi; i++) peak = Math.max(peak, data[i])
    const change = data[hi] - data[0]
    return { change, pct: data[0] ? (change / data[0]) * 100 : 0, drawdown: peak ? ((data[hi] - peak) / peak) * 100 : 0 }
  }, [hi, data])
  const tagY = hi === null ? 0 : Math.max(8, Math.min(H - 8, geo.y(data[at])))
  const crossX = geo.x(at)

  return (
    <div className={cn("w-full max-w-full tabular-nums [--ink-l:0.5] dark:[--ink-l:1]", className)}>
      {/* the header, three tiers (spec 14.1): the title with the window switch, the balance, then its move once */}
      <div className="mb-3 flex items-center justify-between gap-3 text-[12px]">
        <span className="truncate text-foreground/45">{title}</span>
        {showRangeControl && <SegmentedControl
          options={windows.map((w) => w.label)}
          value={win.label}
          onChange={(label) => {
            const next = windows.find((w) => w.label === label)
            if (next) setRange(next.key)
            setHi(null)
          }}
          label="Window"
          className="shrink-0"
        />}
      </div>
      {/* a new window swaps the figures in place (4px, 2px blur, 150ms); the pointer never does */}
      <motion.div
        role="status"
        key={range}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.15, ease: EASE }}
      >
        <p className="m-0 text-[26px] font-semibold leading-none tracking-[-0.02em] text-foreground/90">
          {whole}
          <span className="text-foreground/35">.{cents}</span>
        </p>
        <p className="mb-0 mt-2 flex items-baseline gap-[7px] text-[12px] font-medium" style={{ color: hueOf(stats.change) }}>
          <span>
            {stats.change < 0 ? "−" : "+"}
            {usd(Math.abs(stats.change))} · {signedPct(stats.totalReturn)}
          </span>
          <span className="font-normal text-foreground/45">{span(win)}</span>
        </p>
      </motion.div>

      <div ref={boxRef} className="relative mt-9 cursor-crosshair touch-none" onPointerMove={onMove} onPointerLeave={() => setHi(null)}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full overflow-visible"
          fill="none"
          role="img"
          aria-label={`${title} over the ${span(win)}, now ${usd(stats.last)}, ${signedPct(stats.totalReturn)}, between ${usd(geo.lo)} and ${usd(geo.top)}, max drawdown ${stats.drawdown < 0 ? "−" : ""}${Math.abs(stats.drawdown).toFixed(2)}%`}
        >
          <defs>
            <linearGradient id={`tb-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--foreground)" stopOpacity="0.1" />
              <stop offset="100%" stopColor="var(--foreground)" stopOpacity="0" />
            </linearGradient>
            {/* the line left of the pointer stays full; the rest dims to 0.45 */}
            <clipPath id={`tbl-${uid}`}>
              <rect x={-4} y={-4} width={Math.max(0, crossX + 4)} height={H + 8} />
            </clipPath>
            {/* the entrance: one clip that opens from the left edge, once */}
            <clipPath id={`tbc-${uid}`}>
              <motion.rect
                x={-4}
                y={-4}
                height={H + 8}
                initial={reduced ? false : { width: 0 }}
                animate={{ width: play ? PAD.l + PLOT + 4 : 0 }}
                transition={reduced ? { duration: 0 } : { duration: 0.9, ease: EASE }}
              />
            </clipPath>
          </defs>
          {[0, 0.5, 1].map((f) => {
            const gy = PAD.t + f * (H - PAD.t - PAD.b)
            /* a tick steps aside while the pointed tag sits on it */
            const under = hi !== null && Math.abs(gy - tagY) < 12
            return (
              <g key={f} style={{ opacity: under ? 0 : 1, transition: reduced ? "none" : "opacity 150ms" }}>
                <line x1={PAD.l} x2={PAD.l + PLOT} y1={gy} y2={gy} stroke="var(--foreground)" strokeOpacity={0.05} strokeWidth={1} />
                {/* the ticks hold their places; a new figure fades in over the old one */}
                <AnimatePresence initial={false}>
                  <motion.text
                    key={Math.round(geo.top - f * geo.span)}
                    x={PAD.l + PLOT + 8}
                    y={gy + 3}
                    fontSize={9}
                    fill="var(--foreground)"
                    initial={{ fillOpacity: 0 }}
                    animate={{ fillOpacity: 0.45 }}
                    exit={{ fillOpacity: 0 }}
                    transition={tween}
                  >
                    ${Math.round(geo.top - f * geo.span).toLocaleString("en-US")}
                  </motion.text>
                </AnimatePresence>
              </g>
            )
          })}
          <g clipPath={`url(#tbc-${uid})`} style={{ opacity: hi === null ? 1 : 0.45, transition: reduced ? "none" : "opacity 160ms" }}>
            <motion.path initial={false} animate={{ d: geo.area }} transition={tween} fill={`url(#tb-${uid})`} />
            <motion.path
              initial={false}
              animate={{ d: geo.d }}
              transition={tween}
              stroke="var(--foreground)"
              strokeOpacity={0.9}
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
          {hi !== null && (
            <g pointerEvents="none">
              <g clipPath={`url(#tbl-${uid})`}>
                <path d={geo.area} fill={`url(#tb-${uid})`} />
                <path d={geo.d} stroke="var(--foreground)" strokeOpacity={0.9} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
              </g>
              <line x1={crossX} x2={crossX} y1={0} y2={H} stroke="var(--foreground)" strokeOpacity={0.18} strokeWidth={1} />
              <circle cx={crossX} cy={geo.y(data[at])} r={3} fill="var(--foreground)" stroke="var(--background)" strokeWidth={1.5} />
              <AxisTag x={PAD.l + PLOT + 2} y={tagY} width={PAD.r - 2}>
                ${Math.round(data[at]).toLocaleString("en-US")}
              </AxisTag>
            </g>
          )}
        </svg>

        {/* the pointed point, read beside the cursor (chart-overlay.tsx); it flips left past 60% */}
        <ChartCard
          open={pointed !== null}
          x={`${(crossX / W) * 100}%`}
          flip={crossX > PAD.l + PLOT * 0.6}
          heading={when(win, at)}
          rows={
            pointed
              ? [
                  { label: "Balance", value: usd(data[at]) },
                  { label: "Change", value: `${pointed.change < 0 ? "−" : "+"}${usd(Math.abs(pointed.change))} · ${signedPct(pointed.pct)}`, color: hueOf(pointed.change) },
                  { label: "Drawdown", value: `${pointed.drawdown < 0 ? "−" : ""}${Math.abs(pointed.drawdown).toFixed(2)}%` },
                ]
              : []
          }
          width={184}
        />
      </div>

    </div>
  )
}

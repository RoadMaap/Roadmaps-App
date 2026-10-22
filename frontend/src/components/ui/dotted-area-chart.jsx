import { useEffect, useId, useMemo, useRef, useState } from "react"
import { motion, useInView, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { AxisTag } from "@/components/ui/chart-overlay"
import { LiveFigure } from "@/components/ui/live-figure"

/* Dotted Area Chart, rebuilt through the ssych-component skill (2026-09-29).
   What changed against the version before it (in git history), and why:
   · the line and the dot field are ink, not blue. Colour is kept for the change from the
     open, green or red
   · no raw colours in the source: the fade is an alpha mask on a token, so the white
     stops are gone, and the blue written as numbers is gone
   · the change is signed text, not a tinted chip
   · the scrub dot has no halo because there is no card colour under it
   Motion (2026-10-01): once the chart is in view the line and its dot field sweep in left to
   right through one clip (0.9s; they drew on mount, off screen too); a new series morphs the
   line and the field and glides the gridlines with their ticks.
   2026-10-02 audit: drawn at its real width, 560 (the Price chart family's width), so the
   type and the line no longer scale up by 1.22. The headline moved from under the plot to
   the three tier header on top: the name at /45 with the symbol at /90, the price at 26px
   with its cents at /35, then the move in its hue and the window or the pointed time at
   /45. The "96 bars" count is gone; the open is a dashed guide named on the axis ("$168
   Open", the price at /90, the name at /45) in place of a caption at /35. Gridlines are
   solid at 5%, the axis prints dollars at 9px /45, a row of times runs along the foot, and
   the pointed price is the shared AxisTag. The readout swaps only when a scrub starts or
   ends. New props: `name`, and `start` with `interval` to time the bars.
   Formulas:
   · move = the pointed price (or the last) − the open (the first price)
   · percent = move ÷ the open × 100
   · a bar's time = start + its index × interval
   2026-10-02 round 2: his notes, smaller dots and a lighter gradient at the top. The field's
   dots are 0.7px in radius on a 6px pitch (they were 1.15 on 8), so the texture reads finer,
   and the fade starts at 28% at the top (it was 42%), still falling to nothing at the floor. */

const EASE = [0.16, 1, 0.3, 1]
const GREEN = "var(--chart-up)"
const RED = "var(--chart-down)"
const INK = "var(--foreground)"

const W = 820
const H = 340
const PAD = { r: 112, t: 10, b: 24 }
const ZERO_LINE_Y = (PAD.t + 0.15 * (H - PAD.t - PAD.b) + H - PAD.b) / 2
/** pitch of the dot field under the line (round 2: 6, finer) */
const DOT = 6
/** a dot's radius in the field (round 2: 0.7, smaller) */
const DOT_R = 0.7
/** the fade's strength at the top of the plot (round 2: 0.28, lighter) */
const FADE_TOP = 0.28
/** what the stretch ahead of the pointer falls back to */
const DIM = 0.35

/** deterministic default series, a drifting session close */
const DEFAULT_PRICES = (() => {
  let s = 29
  let v = 168
  const out = []
  for (let i = 0; i < 96; i++) {
    s = (s * 16807) % 2147483647
    v = Math.max(120, v + (s / 2147483647 - 0.45) * 5.6)
    out.push(v)
  }
  return out
})()

const usd = (v) => `${v < 0 ? "−" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const axisUsd = (v) => `${v < 0 ? "−" : ""}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`
/** a time on the foot or in the header: the clock inside two days, the date past that */
const when = (t, span) =>
  span <= 2 * 60_000
    ? new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" })
    : span <= 2 * 86_400_000
      ? new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
    : new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
/** what the move is measured over, at rest */
const windowLabel = (span) => {
  const h = Math.round(span / 3_600_000)
  return h <= 48 ? `past ${h} hours` : `past ${Math.round(h / 24)} days`
}
/** how many times along the foot */
const FOOT = 5

/**
 * A price line standing on a field of dots: the area under it is filled with a dot
 * pattern that fades toward the floor, so the fill reads as texture instead of a slab.
 * Scrubbing splits the chart at the pointer, the stretch already passed stays lit while
 * the rest falls back, the price is tagged on the axis and the header reads that bar with
 * its move from the open.
 */
export function DottedAreaChart({
  name = "Bitcoin",
  symbol = "BTC",
  prices = DEFAULT_PRICES,
  sampleTimes,
  start = Date.UTC(2026, 9, 1, 0, 0),
  interval = 15 * 60_000,
  timeWindowSize,
  referenceValue,
  currentValue,
  showHeader = true,
  showName = true,
  showSymbol = true,
  showChange = true,
  showTimeAxis = true,
  ariaLabel,
  className
}) {
  const reduced = useReducedMotion()
  const svgRef = useRef(null)
  const [hover, setHover] = useState(null)
  const [priceLabelFontSize, setPriceLabelFontSize] = useState(12)
  const uid = useId().replace(/:/g, "")
  /* the entrance plays once, when a third of the chart is in view; reduced motion lands at once */
  const rootRef = useRef(null)
  const seen = useInView(rootRef, { once: true, amount: 0.3 })
  const play = !!reduced || seen
  /** a change of data glides between the two states */
  const morph = reduced ? { duration: 0 } : { duration: 0.35, ease: EASE }

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setPriceLabelFontSize(12 * W / entry.contentRect.width)
    })
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  const { data, n, min, max, x, chartY, line, area, windowSize, windowStart, windowEnd } = useMemo(() => {
    const data = prices.length ? prices : [0]
    const n = data.length
    const windowSize = Math.max(timeWindowSize || n, 2)
    const windowStart = sampleTimes?.[0] ?? start
    const lastSampleTime = sampleTimes?.[n - 1] ?? start + (n - 1) * interval
    const windowEnd = n < windowSize
      ? windowStart + (windowSize - 1) * interval
      : lastSampleTime
    const open = referenceValue ?? data[0]
    const radius = Math.max(...data.map((value) => Math.abs(value - open)), 1) * 1.08
    const min = open - radius
    const max = open + radius
    const x = (i) => {
      const time = sampleTimes?.[i] ?? start + i * interval
      const position = (time - windowStart) / (windowEnd - windowStart || 1)
      return Math.max(0, Math.min(1, position)) * (W - PAD.r)
    }
    const chartY = (v) => {
      const delta = v - open
      const dataRange = delta >= 0 ? max - open : open - min
      const plotRange = delta >= 0 ? ZERO_LINE_Y - PAD.t : H - PAD.b - ZERO_LINE_Y
      return ZERO_LINE_Y - (delta / (dataRange || 1)) * plotRange
    }
    const line = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${chartY(v).toFixed(1)}`).join(" ")
    const area = `${line} L${x(n - 1).toFixed(1)},${H - PAD.b} L0,${H - PAD.b} Z`
    return { data, n, min, max, x, chartY, line, area, windowSize, windowStart, windowEnd }
  }, [prices, sampleTimes, start, interval, timeWindowSize, referenceValue])

  const open = referenceValue ?? data[0]
  const last = data[n - 1]
  const at = hover == null ? currentValue ?? last : data[hover]
  const change = at - open
  const pct = (change / (open || 1)) * 100
  const up = change >= 0
  const hue = up ? GREEN : RED
  const sign = up ? "+" : "−"

  const onMove = (e) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (!r) return
    const px = ((e.clientX - r.left) / r.width) * W
    const nearestIndex = data.reduce((nearest, _, index) => (
      Math.abs(x(index) - px) < Math.abs(x(nearest) - px) ? index : nearest
    ), 0)
    setHover(nearestIndex)
  }

  const dataMin = Math.min(open, ...data)
  const dataMax = Math.max(open, ...data)
  const axisMin = dataMin === dataMax ? open - 1 : dataMin
  const axisMax = dataMin === dataMax ? open + 1 : dataMax
  const ticks = [axisMax, (axisMin + axisMax) / 2, axisMin]
  const span = Math.max(interval, windowEnd - windowStart)
  const time = (i) => sampleTimes?.[i] ?? start + i * interval
  /* even steps of the bar count, so a day of 96 quarter hours reads 00:00, 06:00, 12:00, 18:00 */
  const foot = Array.from({ length: FOOT }, (_, k) => Math.round((k * (windowSize - 1)) / (FOOT - 1))).filter((i) => i < n)
  const [whole, cents] = usd(at).split(".")
  /* the pointed tag, and the open's name on the axis, which steps aside under it */
  const tagY = hover == null ? 0 : Math.max(PAD.t + 8, Math.min(H - PAD.b - 8, chartY(at)))
  const openY = chartY(open)
  const openHidden = hover != null && Math.abs(openY - tagY) < 13

  return (
    <div ref={rootRef} className={cn("flex w-[820px] max-w-full tabular-nums", className)}>
      {/* the header, three tiers (spec 14.1); it swaps only when a scrub starts or ends, and follows the pointer in place */}
      {showHeader && (
        <>
          <div className="mb-3 flex items-baseline justify-between gap-3 text-[12px]">
            {showName && <span className="truncate text-foreground/45">{name}</span>}
            <div className={`flex shrink-0 items-baseline gap-2 ${showName ? '' : 'ms-auto'}`}>
              {showSymbol && <span className="font-medium text-foreground/60">{symbol}</span>}
              <div role="status">
                <LiveFigure intent={hover == null ? null : "scrub"}>
                  <p className="m-0 text-[12px] font-semibold leading-none text-foreground/90">
                    {whole}
                    <span className="text-foreground/35">.{cents}</span>
                  </p>
              {showChange && (
                <p className="mb-0 mt-2 flex items-baseline gap-[7px] text-[12px] font-medium" style={{ color: hue, transition: "color 160ms ease-out" }}>
                  <span>
                    {sign}
                    {usd(Math.abs(change))} · {sign}
                    {Math.abs(pct).toFixed(2)}%
                  </span>
                  <span className="font-normal text-foreground/45">{hover == null ? windowLabel(span) : when(time(hover), span)}</span>
                </p>
              )}
                </LiveFigure>
              </div>
            </div>
          </div>
        </>
      )}

      <svg
        ref={svgRef}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-auto block h-auto w-full cursor-crosshair touch-none overflow-visible"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={ariaLabel || `${name} (${symbol}) price over the ${windowLabel(span)}, last ${usd(last)}, ${last >= open ? "up" : "down"} ${Math.abs(((last - open) / (open || 1)) * 100).toFixed(2)} percent from the open`}
      >
        <defs>
          {/* the dot field: one small dot of ink per 6px cell, the component's own texture */}
          <pattern id={`dots-${uid}`} x="0" y="0" width={DOT} height={DOT} patternUnits="userSpaceOnUse">
            <circle cx={DOT / 2} cy={DOT / 2} r={DOT_R} fill={INK} fillOpacity={0.9} />
          </pattern>
          {/* dots thin out toward the floor so the fill never reads as a block; the mask
              reads alpha, so its stops can be a token in both themes */}
          <linearGradient id={`fade-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={INK} stopOpacity={FADE_TOP} />
            <stop offset="100%" stopColor={INK} stopOpacity="0" />
          </linearGradient>
          <mask id={`mask-${uid}`} style={{ maskType: "alpha" }}>
            <rect x="0" y="0" width={W} height={H} fill={`url(#fade-${uid})`} />
          </mask>
          {/* everything left of the pointer stays lit; the rest falls back */}
          <clipPath id={`past-${uid}`}>
            <rect x="0" y="0" width={hover == null ? W : x(hover)} height={H} />
          </clipPath>
          {/* the one entrance: line and field sweep in left to right, a few px wider for the round caps */}
          <clipPath id={`reveal-${uid}`}>
            <motion.rect
              x={-4}
              y={0}
              height={H}
              initial={reduced ? false : { width: 0 }}
              animate={{ width: play ? W - PAD.r + 8 : 0 }}
              transition={reduced ? { duration: 0 } : { duration: 0.9, ease: EASE }}
            />
          </clipPath>
        </defs>

        {/* gridlines and right-edge price ticks; a tick steps aside for the open's name or the pointed tag */}
        {ticks.map((v, i) => {
          const tickY = chartY(v)
          const under = Math.abs(tickY - openY) < 11 || (hover != null && Math.abs(tickY - tagY) < 12)
          const isOpenTick = Math.abs(v - open) < 1e-9
          return (
            <g key={i}>
              <motion.line
                x1={0}
                x2={W - PAD.r}
                stroke={i === 0 ? GREEN : i === ticks.length - 1 && v < open ? RED : INK}
                strokeOpacity={isOpenTick ? 0 : 0.35}
                strokeWidth={1.2}
                initial={false}
                animate={{ y1: tickY, y2: tickY }}
                transition={morph}
              />
              <motion.text
                x={W - 4}
                textAnchor="end"
                fontSize={priceLabelFontSize}
                fill={INK}
                fillOpacity={0.45}
                className="tabular-nums"
                initial={false}
                animate={{ attrY: tickY + 4 }}
                transition={morph}
                style={{ opacity: under ? 0 : 1, transition: "opacity 150ms" }}
              >
                {axisUsd(v)}
              </motion.text>
            </g>
          )
        })}

        {/* the open: a dashed guide, named on the axis as plain text (spec 14.7) */}
        <line x1={0} x2={W - PAD.r} y1={openY} y2={openY} stroke="#FFFFFF" strokeDasharray="2 4" strokeWidth={1} />
        <text x={W - 4} y={openY + 4} textAnchor="end" fontSize={priceLabelFontSize} fill={INK} pointerEvents="none" style={{ opacity: openHidden ? 0 : 1, transition: "opacity 150ms" }}>
          <tspan fontWeight={500} fillOpacity={0.9}>
            {axisUsd(open)}
          </tspan>
        </text>

        {/* times along the foot */}
        {showTimeAxis && (!sampleTimes || sampleTimes.length > 0) && foot.map((i, k) => (
          <text
            key={`${i}-${k}`}
            x={k === 0 ? 0 : k === FOOT - 1 ? W - PAD.r : x(i)}
            y={H - 6}
            textAnchor={k === 0 ? "start" : k === FOOT - 1 ? "end" : "middle"}
            fontSize={9}
            fill={INK}
            fillOpacity={0.45}
          >
            {when(time(i), span)}
          </text>
        ))}

        {/* resting state, and the bed the lit copy sits on while scrubbing; the group owns
            the hover dim (160ms), the clip owns the one sweep in, the paths morph on new data */}
        <g clipPath={`url(#reveal-${uid})`} style={{ opacity: hover == null ? 1 : DIM, transition: "opacity 160ms ease-out" }}>
          <motion.path
            fill={`url(#dots-${uid})`}
            mask={`url(#mask-${uid})`}
            initial={false}
            animate={{ d: area }}
            transition={morph}
          />
          <motion.path
            fill="none"
            stroke={INK}
            strokeOpacity={0.9}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ d: line }}
            transition={morph}
          />
          <motion.circle
            r={2.5}
            fill={INK}
            initial={false}
            animate={{ cx: x(n - 1), cy: chartY(last) }}
            transition={morph}
          />
        </g>

        {/* the lit stretch behind the pointer */}
        {hover != null && (
          <g clipPath={`url(#past-${uid})`} pointerEvents="none">
            <path d={area} fill={`url(#dots-${uid})`} mask={`url(#mask-${uid})`} />
            <path d={line} fill="none" stroke={INK} strokeOpacity={0.9} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}

        {/* guide, the bar's own dot and its price tagged on the axis (chart-overlay.tsx) */}
        {hover != null && (
          <g pointerEvents="none">
            <line x1={x(hover)} y1={PAD.t} x2={x(hover)} y2={H - PAD.b} stroke={INK} strokeOpacity={0.16} strokeWidth={1} />
            <circle cx={x(hover)} cy={chartY(at)} r={3} fill={INK} />
            <AxisTag x={W - 84} y={tagY} width={96} fontSize={priceLabelFontSize} color={hue}>
              {usd(at)}
            </AxisTag>
          </g>
        )}
      </svg>

    </div>
  )
}

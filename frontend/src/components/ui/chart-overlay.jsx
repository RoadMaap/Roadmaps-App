"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

/* Chart overlay: the two parts every library chart reads a point with (2026-10-02). They
   came out of Candlestick, Volume Profile, the trading terminal and Price Scrubber, which
   had each drawn their own; this is the one copy. Shipped beside the charts that use it.

   AxisTag   the outlined tag on the value axis: the pointed value in its hue, or a named
             reference (POC, last close) in ink. A pill 16px high, 8.5px figures.
   ChartCard the card laid over the chart beside the cursor: a heading row (a time or a
             range) at /60, then label and value rows (labels 10px /60, values 11px /90),
             the one signed figure in its hue. It glides between points on a spring, fades
             in from 0.97 and out in 120ms, and flips to the cursor's left when told to.

   2026-10-02: the card looked out of place over the charts, so it now wears the library
   popover, the same as the sidebar's hover card: a hairline border at 8%, radius 12, the
   6% foreground mix and the popover shadow with no inset highlight (spec 14.6). */

const EASE = [0.16, 1, 0.3, 1]
const GLIDE = {
  type: "spring",
  stiffness: 520,
  damping: 40
}

/** the outlined tag on a chart's value axis, centred on `y` */
export function AxisTag({
  x,
  y,
  width,
  color = "var(--foreground)",
  strong = true,
  hidden = false,
  fontSize = 8.5,
  children
}) {
  const height = Math.max(16, fontSize * 1.25)
  return (
    <g transform={`translate(${x}, ${y - height / 2})`} pointerEvents="none" style={{ opacity: hidden ? 0 : 1, transition: "opacity 150ms" }}>
      <rect width={width} height={height} rx={height / 2} fill="var(--background)" stroke={color} strokeOpacity={strong ? 0.6 : 0.2} />
      <text x={width / 2} y={height / 2 + fontSize * 0.34} textAnchor="middle" fontSize={fontSize} fontWeight={strong ? 600 : 500} fill={color} fillOpacity={strong ? 1 : 0.65}>
        {children}
      </text>
    </g>
  )
}

/** the readout card over a chart; place it inside a `relative` box that holds the svg */
export function ChartCard({
  open,
  x,
  y = 4,
  flip = false,
  width = 148,
  heading,
  rows,
  footer
}) {
  const reduced = useReducedMotion()
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="chart-card"
          role="status"
          className="pointer-events-none absolute z-10"
          initial={{ left: x, top: y, opacity: 0 }}
          animate={{ left: x, top: y, opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={reduced ? { duration: 0 } : { left: GLIDE, top: GLIDE, opacity: { duration: 0.15 } }}
        >
          <motion.div
            className="rounded-[12px] border border-foreground/[0.08] px-3 py-2.5"
            style={{
              width,
              translate: flip ? "calc(-100% - 12px) 0" : "12px 0",
              transition: reduced ? undefined : "translate 200ms cubic-bezier(0.16, 1, 0.3, 1)",
              background: "var(--tip-fill, color-mix(in srgb, var(--foreground) 6%, var(--background)))",
              boxShadow: "0 8px 24px var(--card-shadow, rgba(0,0,0,calc(0.35 * var(--shadow-k, 1))))",
            }}
            initial={reduced ? false : { scale: 0.97 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.15, ease: EASE }}
          >
            <div className="text-[10px] text-foreground/60">{heading}</div>
            <div className="mt-1.5 flex flex-col gap-1">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-3">
                  <span className="text-[10px] text-foreground/60">{r.label}</span>
                  <span className="text-[11px] text-foreground/90" style={r.color ? { color: r.color } : undefined}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
            {footer && <div className="mt-1.5 text-[10px]">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

/* Live figure: a figure fed by a live stream (2026-10-02, out of Tape Flow, where a price
   that re-entered on every print read as a flicker). The value changes in place on each
   tick; the figure swaps (4px, 2px blur, 150ms) only when `intent` changes: the pointer
   takes a point, lets it go, or a toggle flips. Pass the pointed point's id, or null for
   the live value. */

const EASE = [0.16, 1, 0.3, 1]

export function LiveFigure({
  intent,
  className,
  children
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      key={intent === null ? "live" : `at-${intent}`}
      className={cn(className)}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.15, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

import { useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Eye } from "@/components/animate-ui/icons/eye"
import { EyeOff } from "@/components/animate-ui/icons/eye-off"

import { cn } from "@/lib/utils"

/* Balance Header, rebuilt through the ssych-component skill (2026-09-29).
   What changed against the version before it (in git history), and why:
   · one large size, 26px, for the whole figure. The cents step back by ink, not by a
     second size (it was 44px dollars over 26px cents)
   · the label is sentence case at its own size, no capitals and no letter spacing
   · the figure is plain text, not a heading tag: the page owns the headings
   · the move is signed text in green or red. The tinted pill and the chevrons are gone,
     the + or − already says the direction
   · the hide control is a round button; the eye stays because it is the control
   · every figure is tabular, the header reads itself out as one status line
   Props are unchanged.
   2026-10-02 audit: it reads from the left like every other header now, on the three tiers
   of spec 14.1: a 12px label row ("Total balance" /45 left, the hide control right, where
   it no longer floats beside the figure), the 26px figure with leading-none 12px under it,
   and a 12px sub line 8px under that, the move font-medium in its hue then the period /45.
   The move reads "+$1,204.32 (+1.9%)", no middle dot. The hide control shows on hover or
   focus, and always where there is no hover.
   Formulas:
   · percent  change ÷ (total − change) × 100, the move over the balance it moved from,
              unless the caller passes changePct */

const EASE = [0.16, 1, 0.3, 1]
const GREEN = "var(--chart-up)"
const RED = "var(--chart-down)"

/** Σ of the sample book the portfolio family quotes from */
const DEFAULT_TOTAL = 64025.65
const DEFAULT_CHANGE = 1204.32

const MASK = "••••••"

const usd = (n, dp = 2) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`

/**
 * A wallet's headline number: a quiet label over the total with its cents stepped back,
 * the signed move beneath, and a hide control that stays out of the way until you reach
 * for it, then masks every figure to dots.
 */
export function BalanceHeader({
  title = "Total balance",
  total = DEFAULT_TOTAL,
  change = DEFAULT_CHANGE,
  changePct,
  delta = true,
  period = "24h",
  actions,
  className
}) {
  const [hidden, setHidden] = useState(false)
  const reduced = useReducedMotion()
  const up = change >= 0
  const hue = up ? GREEN : RED
  const sign = up ? "+" : "−"
  /* the move over the balance it moved FROM, so the two numbers agree */
  const pct = changePct ?? (change / (total - change || 1)) * 100
  const move = `${sign}${usd(Math.abs(change))} (${sign}${Math.abs(pct).toFixed(1)}%)`

  const [whole, cents] = usd(total).split(".")

  const rise = (delay) => ({
    initial: reduced ? (false) : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: reduced ? { duration: 0 } : { duration: 0.4, ease: EASE, delay },
  })

  /* hide / show swaps the text in place (transitions.dev text swap: 4px, 2px blur, 150ms);
     reduced motion keeps the cross-fade and drops the travel and the blur */
  const swap = {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: reduced ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)" },
    transition: { duration: 0.15, ease: EASE },
  }

  return (
    <div
      className={cn("group flex w-full min-w-0 flex-col items-stretch tabular-nums", className)}
      role="group"
      aria-label={hidden ? `${title}, hidden` : `${title} ${usd(total)}${delta ? `, ${move} over ${period}` : ""}`}
    >
      <motion.div {...rise(0)} className="mb-3 flex items-baseline justify-between gap-3 text-[12px]">
        <span className="text-foreground/45">{title}</span>
        {actions}
        {/* the hide control sits at the row's end, so it never nudges the figure; it keeps
            the 12px row by bleeding into the padding around it */}
        <button
          type="button"
          onClick={() => setHidden((h) => !h)}
          aria-label={hidden ? "Show balances" : "Hide balances"}
          aria-pressed={hidden}
          className="-my-1.5 grid h-6 w-6 shrink-0 self-center place-items-center rounded-full text-foreground/60 opacity-100 outline-none transition-[color,background-color,transform,translate,scale,rotate] duration-200 active:scale-[0.97] hover:bg-foreground/[0.06] hover:text-foreground/90 focus-visible:bg-foreground/[0.06] motion-reduce:active:scale-100"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={hidden ? "off" : "on"}
              className="grid place-items-center"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8, filter: "blur(2px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8, filter: "blur(2px)" }}
              transition={{ duration: 0.12, ease: EASE }}
            >
              {hidden
                ? <EyeOff size={13} animateOnHover aria-hidden />
                : <Eye size={13} animateOnHover animation="look" aria-hidden />}
            </motion.span>
          </AnimatePresence>
        </button>
      </motion.div>

      <motion.p {...rise(0.035)} role="status" className="m-0 text-[26px] font-semibold leading-none tracking-[-0.02em] text-foreground/90">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={hidden ? "mask" : "figure"} {...swap} className="inline-block">
            {hidden ? (
              MASK
            ) : (
              <>
                {whole}
                {cents && <span className="text-foreground/35">.{cents}</span>}
              </>
            )}
          </motion.span>
        </AnimatePresence>
      </motion.p>

      {delta && (
        <motion.div {...rise(0.07)} className="mt-2 flex items-baseline gap-1.5 text-[12px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={hidden ? "mask" : "move"}
              {...swap}
              className="inline-block font-medium"
              style={{ color: hidden ? "color-mix(in srgb, var(--foreground) 45%, transparent)" : hue }}
            >
              {hidden ? MASK : move}
            </motion.span>
          </AnimatePresence>
          <span className="text-foreground/45">{period}</span>
        </motion.div>
      )}
    </div>
  )
}

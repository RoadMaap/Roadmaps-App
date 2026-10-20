import { useId, useState } from "react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { SEGMENT_OFF, THUMB, TRACK } from "@/components/ui/control-classes"

/**
 * The range switcher as a primitive: a hairline pill whose thumb glides
 * between options with a shared-layout tween. Tabular labels, no chrome.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  label
}) {
  const reduced = useReducedMotion()
  const uid = useId()
  const [inner, setInner] = useState(value ?? options[0])
  const current = value ?? inner

  return (
    <div role="group" aria-label={label} className={cn("inline-flex items-center gap-0.5 tabular-nums", TRACK, className)}>
      {options.map((o) => {
        const on = o === current
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => {
              setInner(o)
              onChange?.(o)
            }}
            className={cn(
              "group relative inline-flex h-7 items-center rounded-full px-3 text-[11.5px] outline-none transition-colors duration-200 focus-visible:text-foreground/90",
              on ? "text-foreground/90" : SEGMENT_OFF,
            )}
          >
            {on && (
              /* transitions.dev sliding-tabs feel: a clean 250ms smooth-out tween */
              <motion.span
                layoutId={`${uid}-thumb`}
                className={cn("absolute inset-0 rounded-full", THUMB)}
                transition={reduced ? { duration: 0 } : { duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
            {/* the press answers on the label, so the thumb's layout glide measures an unscaled button */}
            <span className="relative inline-block transition-transform duration-150 group-active:scale-[0.97] motion-reduce:transition-none motion-reduce:group-active:scale-100">{o}</span>
          </button>
        )
      })}
    </div>
  )
}

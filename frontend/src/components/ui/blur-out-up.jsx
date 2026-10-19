import { motion, useInView, useReducedMotion } from 'motion/react';
import { useRef } from 'react';

const DURATION_S = 0.56;
const MS = 1000;
const EASE = [0.22, 1, 0.36, 1];

export default function BlurOutUp({
    children,
    className = '',
    delay = 0,
    stagger = 28,
    triggerOnView = false,
}) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true });
    const shouldReduceMotion = useReducedMotion();
    const play = (!triggerOnView || inView) && !shouldReduceMotion;
    const words = children.split(' ');

    return (
        <span aria-label={children} className={className} ref={ref}>
            {words.map((word, index) => (
                <span key={index}>
                    <motion.span
                        animate={play ? { filter: 'blur(0px)', opacity: 1, y: 0 } : undefined}
                        aria-hidden="true"
                        initial={
                            shouldReduceMotion
                                ? { opacity: 1 }
                                : { filter: 'blur(6px)', opacity: 0, y: 10 }
                        }
                        style={{ display: 'inline-block', whiteSpace: 'pre' }}
                        transition={
                            shouldReduceMotion
                                ? { duration: 0 }
                                : {
                                      delay: delay / MS + (index * stagger) / MS,
                                      duration: DURATION_S,
                                      ease: EASE,
                                  }
                        }
                    >
                        {word}
                    </motion.span>
                    {index < words.length - 1 && (
                        <span aria-hidden="true" style={{ display: 'inline-block', whiteSpace: 'pre' }}>
                            {' '}
                        </span>
                    )}
                </span>
            ))}
        </span>
    );
}
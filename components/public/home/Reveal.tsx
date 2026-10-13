"use client";

import type { ReactNode } from "react";
import { LazyMotion, MotionConfig, domAnimation, m, type Variants } from "motion/react";

// Motion is loaded through LazyMotion with the small `domAnimation` feature
// set (no layout animations), and `strict` makes an accidental full `motion.*`
// import fail loudly instead of quietly shipping the whole library.
// reducedMotion="user" drops transforms for visitors who ask for less motion;
// opacity fades remain.

export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

const EASE = [0.22, 1, 0.36, 1] as const;

// `delay` is only set when asked for: an explicit delay on a child would
// replace the one its RevealGroup's stagger hands down.
const rise: Variants = {
  hidden: { opacity: 0, y: 26 },
  shown: (delay?: number) => ({
    opacity: 1,
    y: 0,
    transition: delay ? { duration: 0.65, ease: EASE, delay } : { duration: 0.65, ease: EASE },
  }),
};

/** Fades and lifts its content in the first time it scrolls into view. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <m.div
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount: 0.2 }}
      variants={rise}
      custom={delay}
    >
      {children}
    </m.div>
  );
}

/** A container whose RevealItem children come in one after another. */
export function RevealGroup({
  children,
  className,
  stagger = 0.07,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  return (
    <m.div
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount: 0.15 }}
      variants={{ hidden: {}, shown: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </m.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <m.div className={className} variants={rise}>
      {children}
    </m.div>
  );
}

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";

export default function MouseFollower() {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);
  const springX = useSpring(mouseX, { stiffness: 500, damping: 30, mass: 0.5 });
  const springY = useSpring(mouseY, { stiffness: 500, damping: 30, mass: 0.5 });
  const [hoveredInfo, setHoveredInfo] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let rafId: number;
    let lastX = -100;
    let lastY = -100;
    let lastTarget: HTMLElement | null = null;

    const handleMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      lastTarget = e.target as HTMLElement;
    };

    // Use rAF to batch mouse updates to once per frame
    const tick = () => {
      mouseX.set(lastX - 12);
      mouseY.set(lastY - 12);

      const target = lastTarget?.closest<HTMLElement>("[data-lens]");
      const info = target?.getAttribute("data-lens") ?? null;
      setHoveredInfo((prev) => (prev !== info ? info : prev));
      setVisible(!!target);

      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    rafId = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      cancelAnimationFrame(rafId);
    };
  }, [mouseX, mouseY]);

  // Not rendered on touch devices
  if (typeof window !== "undefined" && "ontouchstart" in window) return null;

  return (
    <motion.div
      ref={ref}
      className="fixed top-0 left-0 z-[9999] pointer-events-none mix-blend-difference"
      style={{
        x: springX,
        y: springY,
        scale: visible ? 4 : 1,
      }}
    >
      <div className="w-6 h-6 rounded-full border border-white/60 flex items-center justify-center">
        <AnimatePresence>
          {hoveredInfo && (
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="text-[3px] text-white font-medium text-center leading-tight whitespace-nowrap"
            >
              {hoveredInfo}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

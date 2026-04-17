"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

interface Props {
  text: string;
  className?: string;
  wordColor?: string;
}

export default function MaskRevealText({ text, className = "", wordColor = "text-white" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "end 0.4"],
  });

  const words = text.split(" ");

  return (
    <div ref={ref} className={`flex flex-wrap justify-center gap-x-[0.35em] ${className}`}>
      {words.map((word, i) => {
        const start = i / words.length;
        const end = Math.min(start + 1 / words.length + 0.15, 1);
        return <Word key={i} word={word} range={[start, end]} progress={scrollYProgress} wordColor={wordColor} />;
      })}
    </div>
  );
}

function Word({
  word,
  range,
  progress,
  wordColor,
}: {
  word: string;
  range: [number, number];
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
  wordColor: string;
}) {
  const opacity = useTransform(progress, range, [0.12, 1]);
  const y = useTransform(progress, range, [8, 0]);

  return (
    <motion.span
      style={{ opacity, y }}
      className={`font-sans text-[clamp(2rem,8vw,6rem)] font-semibold ${wordColor} leading-[1.05] inline-block`}
    >
      {word}
    </motion.span>
  );
}

"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import DigitalLoomBackground from "./digital-loom-background";

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.2,
      duration: 1,
      ease: "easeInOut",
    },
  }),
};

const DemoOne = () => {
  return (
    <DigitalLoomBackground>
      <div className="text-center max-w-4xl mx-auto px-4">
        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          custom={0}
          className="mb-6 inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-2 text-sm text-white/80 backdrop-blur-md"
        >
          A New Dimension of UI
        </motion.div>

        <motion.h1
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          custom={1}
          className="text-5xl font-bold tracking-tight text-white sm:text-7xl md:text-8xl"
        >
          The Digital Loom
        </motion.h1>

        <motion.p
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          custom={2}
          className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-white/60"
        >
          An intricate and futuristic hero section featuring a dynamic
          background of beautifully interwoven, animated threads.
        </motion.p>

        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          custom={3}
          className="mt-12 flex items-center justify-center gap-x-6"
        >
          <button className="rounded-full bg-white px-8 py-4 text-lg font-semibold text-black shadow-lg shadow-white/20 transition-transform hover:scale-105">
            Weave Your Story
          </button>
        </motion.div>
      </div>
    </DigitalLoomBackground>
  );
};

export default DemoOne;

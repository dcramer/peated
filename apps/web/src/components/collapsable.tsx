"use client";

import { LazyMotion, domAnimation, m } from "framer-motion";
import { type ReactNode } from "react";

export default function Collapsable({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const animate = {
    transition: { type: "tween" },
    height: open ? "auto" : 0,
    //opacity: open ? 1 : .5
  };

  return (
    <LazyMotion features={domAnimation} strict>
      <div aria-expanded={open}>
        <m.div
          style={{ overflow: "hidden" }}
          initial={{ height: 0, opacity: 1 }}
          animate={animate}
          exit={{ height: 0, opacity: 1 }}
        >
          {children}
        </m.div>
      </div>
    </LazyMotion>
  );
}

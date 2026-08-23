"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import { useRef, useState } from "react";
import { useOnClickOutside } from "usehooks-ts";
import classNames from "../lib/classNames";

type Props = {
  title: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  origin?: "left" | "right" | "center";
  style?: CSSProperties;
};

export default function Tooltip({
  title,
  children,
  origin = "right",
  className,
  contentClassName,
  style,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  // SAFETY: The hook's legacy type omits React 19's nullable ref value.
  useOnClickOutside(ref as RefObject<HTMLElement>, () => setVisible(false));

  return (
    <div
      className={classNames(
        className || "inline-flex",
        "group relative cursor-help",
      )}
      onClick={() => {
        setVisible(!visible);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setVisible(!visible);
        }
      }}
      role="button"
      tabIndex={0}
      style={style}
    >
      {children}
      <span
        className={classNames(
          "absolute top-6 z-10 scale-0 transition-all group-hover:scale-100 group-focus:scale-100 group-active:scale-100",
          contentClassName ||
            "w-48 max-w-48 rounded bg-slate-700 p-2 text-center text-xs text-slate-400",
          origin === "right" ? "right-0" : "",
          origin === "left" ? "left-0" : "",
          origin === "center" ? "left-1/2 -translate-x-1/2" : "",
          visible ? "scale-100" : "",
        )}
        ref={ref}
      >
        {title}
      </span>
    </div>
  );
}

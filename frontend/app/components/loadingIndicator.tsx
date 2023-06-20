import { useNavigation } from "@remix-run/react";
import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";
import styles from "./loadingIndicator.module.css";

// https://edmund.dev/articles/setting-up-a-global-loading-indicator-in-remix
function useProgress(): MutableRefObject<HTMLDivElement | null> {
  const el = useRef<HTMLDivElement | null>(null);
  const timeout = useRef<NodeJS.Timeout>();
  const { location } = useNavigation();

  useEffect(() => {
    if (!location || !el.current) {
      return;
    }

    if (timeout.current) {
      clearTimeout(timeout.current);
    }

    el.current.style.width = `0%`;

    const updateWidth = (ms: number) => {
      timeout.current = setTimeout(() => {
        if (!el.current) return;
        const width = parseFloat(el.current.style.width);
        const percent = !isNaN(width) ? 10 + 0.9 * width : 0;

        el.current.style.width = `${percent}%`;

        updateWidth(100);
      }, ms);
    };

    updateWidth(100);

    return () => {
      clearTimeout(timeout.current);

      if (!el.current || el.current.style.width === `0%`) {
        return;
      }

      el.current.style.width = `100%`;
      timeout.current = setTimeout(() => {
        if (el.current?.style.width !== "100%") {
          return;
        }
        el.current.style.width = ``;
      }, 200);
    };
  }, [location]);

  return el;
}

export default function LoadingIndicator() {
  const progress = useProgress();

  return (
    <div className={styles.root}>
      <div className={styles.progress} ref={progress} />
    </div>
  );
}

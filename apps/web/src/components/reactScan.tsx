"use client";

// react-scan must be imported before react
import { scan } from "react-scan";

import type { JSX} from "react";
import { useEffect } from "react";

export function ReactScan({ enabled }: { enabled: boolean }): JSX.Element {
  useEffect(() => {
    scan({
      enabled,
    });
  }, [enabled]);

  return <></>;
}

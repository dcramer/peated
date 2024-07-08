"use client";

import type { ComponentPropsWithoutRef } from "react";
import MapClient from "./map.client";

export default function Map({
  width,
  height,
  ...props
}: ComponentPropsWithoutRef<typeof MapClient>) {
  if (typeof window === "undefined") {
    return (
      <div
        style={{ height, width }}
        className="animate-pulse rounded bg-slate-800"
      />
    );
  }

  return <MapClient width={width} height={height} {...props} />;
}

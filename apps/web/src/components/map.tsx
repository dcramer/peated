"use client";

import dynamic from "next/dynamic";
import type { ComponentPropsWithoutRef } from "react";

const MapClient = dynamic(() => import("./map.client"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded bg-slate-800" />
  ),
});

export default function Map({
  width,
  height,
  ...props
}: ComponentPropsWithoutRef<typeof MapClient>) {
  return <MapClient width={width} height={height} {...props} />;
}

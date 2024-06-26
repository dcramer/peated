"use client";

import type { ComponentPropsWithoutRef } from "react";
import QRCodeClient from "./qrcode.client";

export default function QRCode({
  ...props
}: ComponentPropsWithoutRef<typeof QRCodeClient>) {
  if (typeof window === "undefined") {
    return <div />;
  }

  return <QRCodeClient {...props} />;
}

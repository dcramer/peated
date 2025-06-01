"use client";

import QRCode from "react-qr-code";

export default function QRCodeClient({ value }: { value?: string }) {
  return (
    <div className="mx-auto h-auto w-full">
      <QRCode
        value={value ?? window.location.href}
        size={256}
        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
        viewBox={"0 0 256 256"}
        fgColor="#020617"
      />
    </div>
  );
}

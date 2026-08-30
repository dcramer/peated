"use client";

import * as stylex from "@stylexjs/stylex";
import QRCode from "react-qr-code";

export default function QRCodeClient({ value }: { value: string }) {
  return (
    <div {...stylex.props(styles.frame)}>
      <QRCode
        bgColor="#ffffff"
        fgColor="#101210"
        size={256}
        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
        value={value}
        viewBox="0 0 256 256"
      />
    </div>
  );
}

const styles = stylex.create({
  frame: {
    boxSizing: "border-box",
    width: "100%",
    height: "auto",
    marginRight: "auto",
    marginLeft: "auto",
    padding: "8px",
    backgroundColor: "#ffffff",
  },
});

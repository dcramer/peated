import type { ReactNode } from "react";

export default function ModerationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="-my-4 lg:-m-8">{children}</div>;
}

import type { ReactNode } from "react";

export default function DefaultLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <>{children}</>;
}

import type { ReactNode } from "react";

export default function Layout({
  children,
  panel,
}: {
  children: ReactNode;
  panel: ReactNode;
}) {
  return (
    <>
      {children}
      {panel}
    </>
  );
}

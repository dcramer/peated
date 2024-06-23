import SimpleHeader from "@peated/web/components/simpleHeader";
import { type ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <SimpleHeader>Favorites</SimpleHeader>
      {children}
    </>
  );
}

import SimpleHeader from "@peated/web/components/simpleHeader";
import { type ReactNode } from "react";

export default async function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <SimpleHeader>Friends</SimpleHeader>
      {children}
    </>
  );
}

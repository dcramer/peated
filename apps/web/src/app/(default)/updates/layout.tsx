import SimpleHeader from "@peated/web/components/simpleHeader";
import { type Metadata } from "next";
import { type ReactNode } from "react";

export const metadata: Metadata = {
  title: "Updates",
};

export default async function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <SimpleHeader>Updates</SimpleHeader>
      {children}
    </>
  );
}

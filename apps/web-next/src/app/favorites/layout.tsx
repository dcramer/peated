import { type Metadata } from "next";
import { type ReactNode } from "react";

export const metadata: Metadata = {
  title: "Favorites",
};

export default function Layout({
  auth,
  children,
}: Readonly<{
  auth: ReactNode;
  children: ReactNode;
}>) {
  return (
    <>
      {auth}
      {children}
    </>
  );
}

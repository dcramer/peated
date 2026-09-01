import type { ReactNode } from "react";
import { ApplicationLayout } from "./_components/applicationLayout.stylex";

export default function ApplicationRouteLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ApplicationLayout>{children}</ApplicationLayout>;
}

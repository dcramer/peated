import { ApplicationShell } from "@peated/web/components/designSystem/product/applicationShell.stylex";
import type { ReactNode } from "react";

export default function RedesignLayout({ children }: { children: ReactNode }) {
  return <ApplicationShell>{children}</ApplicationShell>;
}

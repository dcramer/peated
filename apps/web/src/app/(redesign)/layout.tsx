import { ApplicationLayout } from "@peated/web/components/designSystem/product/applicationLayout.stylex";
import type { ReactNode } from "react";

export default function RedesignLayout({ children }: { children: ReactNode }) {
  return <ApplicationLayout>{children}</ApplicationLayout>;
}

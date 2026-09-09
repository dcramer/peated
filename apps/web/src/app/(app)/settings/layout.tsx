import type { ReactNode } from "react";

import { AuthRequired } from "@peated/web/hooks/useAuthRequired";
import { noIndexPageMetadata } from "@peated/web/lib/seoMetadata";
import type { Metadata } from "next";
import { SettingsPageFrame } from "./settingsPageFrame.stylex";

export const metadata: Metadata = noIndexPageMetadata;

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <AuthRequired>
      <SettingsPageFrame>{children}</SettingsPageFrame>
    </AuthRequired>
  );
}

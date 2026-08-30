import type { ReactNode } from "react";

import { AuthRequired } from "@peated/web/hooks/useAuthRequired";
import { SettingsPageFrame } from "./settingsPageFrame.stylex";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <AuthRequired>
      <SettingsPageFrame>{children}</SettingsPageFrame>
    </AuthRequired>
  );
}

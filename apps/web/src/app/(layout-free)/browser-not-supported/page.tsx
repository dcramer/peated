import { ButtonLink } from "@peated/web/components/designSystem/components";
import {
  AuthActionStack,
  AuthDetailList,
  AuthDivider,
  AuthFooterLinks,
  AuthFormSurface,
  AuthLink,
  AuthPanel,
} from "@peated/web/components/designSystem/patterns/authShell.stylex";
import { ProductAuthShell } from "@peated/web/components/designSystem/product/authPageShell.stylex";
import config from "@peated/web/config";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browser Not Supported",
};

export default function BrowserNotSupported() {
  return (
    <ProductAuthShell intro="database">
      <AuthPanel
        description="This browser does not support the passkey features Peated uses for secure authentication."
        title="Passkeys aren’t available here"
      >
        <AuthActionStack>
          <AuthFormSurface>
            <AuthDetailList
              items={[
                "Chrome 67 or newer on desktop and Android",
                "Safari 14 or newer on macOS and iOS",
                "Edge 79 or newer",
                "Firefox 60 or newer",
              ]}
            />
          </AuthFormSurface>
          {config.GOOGLE_CLIENT_ID ? (
            <ButtonLink
              align="start"
              fullWidth
              href="/login"
              size="lg"
              variant="accent"
            >
              Use another sign-in method
            </ButtonLink>
          ) : null}
          <ButtonLink
            align="start"
            fullWidth
            href="/login"
            size="lg"
            variant={config.GOOGLE_CLIENT_ID ? "tonal" : "accent"}
          >
            Return to sign in
          </ButtonLink>
        </AuthActionStack>
        <AuthDivider />
        <AuthFooterLinks>
          <AuthLink href="https://passkeys.dev/device-support/">
            Learn more about passkey support
          </AuthLink>
        </AuthFooterLinks>
      </AuthPanel>
    </ProductAuthShell>
  );
}

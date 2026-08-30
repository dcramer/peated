import { AuthenticationPage } from "@peated/web/components/auth/authenticationPage.stylex";
import { ButtonLink } from "@peated/web/components/designSystem/components";
import {
  AuthenticationActions,
  AuthenticationCard,
  AuthenticationDetails,
  AuthenticationDivider,
  AuthenticationLink,
  AuthenticationLinks,
  AuthenticationPanel,
} from "@peated/web/components/designSystem/patterns/authentication.stylex";
import config from "@peated/web/config";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browser Not Supported",
};

export default function BrowserNotSupported() {
  return (
    <AuthenticationPage intro="database">
      <AuthenticationPanel
        description="This browser does not support the passkey features Peated uses for secure authentication."
        title="Passkeys aren’t available here"
      >
        <AuthenticationActions>
          <AuthenticationCard>
            <AuthenticationDetails
              items={[
                "Chrome 67 or newer on desktop and Android",
                "Safari 14 or newer on macOS and iOS",
                "Edge 79 or newer",
                "Firefox 60 or newer",
              ]}
            />
          </AuthenticationCard>
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
        </AuthenticationActions>
        <AuthenticationDivider />
        <AuthenticationLinks>
          <AuthenticationLink href="https://passkeys.dev/device-support/">
            Learn more about passkey support
          </AuthenticationLink>
        </AuthenticationLinks>
      </AuthenticationPanel>
    </AuthenticationPage>
  );
}

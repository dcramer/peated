import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button, ButtonLink, Checkbox, Field, TextInput } from "..";
import { StoryCanvas } from "../storyFixtures.stylex";
import {
  AuthenticationActions,
  AuthenticationCard,
  AuthenticationDetails,
  AuthenticationLink,
  AuthenticationNotice,
  AuthenticationPanel,
} from "./authentication.stylex";

const meta = {
  title: "Components/Forms/Authentication Panel",
  component: AuthenticationPanel,
  args: {
    children: null,
    title: "Authentication",
  },
  argTypes: {
    back: { control: false },
    children: { control: false },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof AuthenticationPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Recovery: Story = {
  render: () => (
    <AuthenticationPanel
      description="We’ll email a one-time link so you can restore access."
      title="Recover your account"
    >
      <AuthenticationActions>
        <AuthenticationCard>
          <Field htmlFor="story-recovery-email" label="Email" required>
            <TextInput
              id="story-recovery-email"
              placeholder="you@example.com"
              type="email"
            />
          </Field>
        </AuthenticationCard>
        <Button align="start" fullWidth size="lg" variant="accent">
          Send recovery link
        </Button>
      </AuthenticationActions>
    </AuthenticationPanel>
  ),
};

export const CheckEmail: Story = {
  render: () => (
    <AuthenticationPanel
      description="Follow the secure link we sent to continue."
      title="Check your email"
    >
      <AuthenticationNotice>
        Recovery instructions are on their way.
      </AuthenticationNotice>
    </AuthenticationPanel>
  ),
};

export const UpdatedTerms: Story = {
  render: () => (
    <AuthenticationPanel
      description="Review and accept the latest Terms of Service to continue."
      title="One thing before you continue"
    >
      <AuthenticationActions>
        <AuthenticationCard>
          <Checkbox
            label={
              <>
                I agree to the updated{" "}
                <AuthenticationLink href="/terms">
                  Terms of Service
                </AuthenticationLink>
                .
              </>
            }
          />
        </AuthenticationCard>
        <Button align="start" disabled fullWidth size="lg" variant="accent">
          Accept and continue
        </Button>
      </AuthenticationActions>
    </AuthenticationPanel>
  ),
};

export const BrowserSupport: Story = {
  render: () => (
    <AuthenticationPanel
      description="This browser does not support the passkey features Peated uses."
      title="Passkeys aren’t available here"
    >
      <AuthenticationActions>
        <AuthenticationCard>
          <AuthenticationDetails
            items={[
              "Chrome 67 or newer",
              "Safari 14 or newer",
              "Edge 79 or newer",
              "Firefox 60 or newer",
            ]}
          />
        </AuthenticationCard>
        <ButtonLink
          align="start"
          fullWidth
          href="/login"
          size="lg"
          variant="accent"
        >
          Return to sign in
        </ButtonLink>
      </AuthenticationActions>
    </AuthenticationPanel>
  ),
};

export const ApplicationConsent: Story = {
  render: () => (
    <AuthenticationPanel
      description="This application will receive API access as @caskstrength_k."
      title="Authorize Cellar Exporter?"
    >
      <AuthenticationNotice>
        It can perform the same Peated API actions your account can. Peated does
        not share your password or sign-in credentials.
      </AuthenticationNotice>
      <AuthenticationActions>
        <Button align="start" fullWidth size="lg" variant="accent">
          Allow access
        </Button>
        <Button align="start" fullWidth size="lg" variant="tonal">
          Deny
        </Button>
      </AuthenticationActions>
    </AuthenticationPanel>
  ),
};

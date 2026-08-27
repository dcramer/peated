import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button, ButtonLink, Checkbox, Field, TextInput } from "../components";
import { StoryCanvas } from "../storyFixtures.stylex";
import {
  AuthActionStack,
  AuthDetailList,
  AuthFormSurface,
  AuthLink,
  AuthNotice,
  AuthPanel,
} from "./authShell.stylex";

const meta = {
  title: "Patterns/Authentication/Auth Panel",
  component: AuthPanel,
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
} satisfies Meta<typeof AuthPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Recovery: Story = {
  render: () => (
    <AuthPanel
      description="We’ll email a one-time link so you can restore access."
      title="Recover your account"
    >
      <AuthActionStack>
        <AuthFormSurface>
          <Field htmlFor="story-recovery-email" label="Email" required>
            <TextInput
              id="story-recovery-email"
              placeholder="you@example.com"
              type="email"
            />
          </Field>
        </AuthFormSurface>
        <Button align="start" fullWidth size="lg" variant="accent">
          Send recovery link
        </Button>
      </AuthActionStack>
    </AuthPanel>
  ),
};

export const CheckEmail: Story = {
  render: () => (
    <AuthPanel
      description="Follow the secure link we sent to continue."
      title="Check your email"
    >
      <AuthNotice>Recovery instructions are on their way.</AuthNotice>
    </AuthPanel>
  ),
};

export const UpdatedTerms: Story = {
  render: () => (
    <AuthPanel
      description="Review and accept the latest Terms of Service to continue."
      title="One thing before you continue"
    >
      <AuthActionStack>
        <AuthFormSurface>
          <Checkbox
            label={
              <>
                I agree to the updated{" "}
                <AuthLink href="/terms">Terms of Service</AuthLink>.
              </>
            }
          />
        </AuthFormSurface>
        <Button align="start" disabled fullWidth size="lg" variant="accent">
          Accept and continue
        </Button>
      </AuthActionStack>
    </AuthPanel>
  ),
};

export const BrowserSupport: Story = {
  render: () => (
    <AuthPanel
      description="This browser does not support the passkey features Peated uses."
      title="Passkeys aren’t available here"
    >
      <AuthActionStack>
        <AuthFormSurface>
          <AuthDetailList
            items={[
              "Chrome 67 or newer",
              "Safari 14 or newer",
              "Edge 79 or newer",
              "Firefox 60 or newer",
            ]}
          />
        </AuthFormSurface>
        <ButtonLink
          align="start"
          fullWidth
          href="/login"
          size="lg"
          variant="accent"
        >
          Return to sign in
        </ButtonLink>
      </AuthActionStack>
    </AuthPanel>
  ),
};

export const ApplicationConsent: Story = {
  render: () => (
    <AuthPanel
      description="This application will receive API access as @caskstrength_k."
      title="Authorize Cellar Exporter?"
    >
      <AuthNotice>
        It can perform the same Peated API actions your account can. Peated does
        not share your password or sign-in credentials.
      </AuthNotice>
      <AuthActionStack>
        <Button align="start" fullWidth size="lg" variant="accent">
          Allow access
        </Button>
        <Button align="start" fullWidth size="lg" variant="tonal">
          Deny
        </Button>
      </AuthActionStack>
    </AuthPanel>
  ),
};

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button, ButtonLink } from "../components";
import {
  AuthActionStack,
  AuthDivider,
  AuthFooterLinks,
  AuthIntro,
  AuthLink,
  AuthPanel,
  AuthShell,
} from "./authShell.stylex";

function SignInShell() {
  return (
    <AuthShell
      intro={
        <AuthIntro
          artwork={{
            alt: "",
            src: "/assets/auth-discovery-illustration.webp",
          }}
          description="Sign in to record what you pour, keep your library, and see critic and community views side by side."
          facts={[
            { label: "Bottles", value: "47,402" },
            { label: "Brands, distillers & bottlers", value: "2,418" },
          ]}
          footer={
            <AuthLink href="/bottles">Browse without an account →</AuthLink>
          }
          title="Every bottle, every review, in one place."
        />
      }
    >
      <AuthPanel
        description="A passkey is fastest. Email works everywhere."
        title="Sign in"
      >
        <AuthActionStack>
          <Button align="start" fullWidth size="lg" variant="tonal">
            Continue with a passkey
          </Button>
          <Button align="start" fullWidth size="lg" variant="tonal">
            Continue with Google
          </Button>
          <Button align="start" fullWidth size="lg" variant="tonal">
            Continue with email
          </Button>
        </AuthActionStack>
        <AuthDivider />
        <AuthFooterLinks>
          <span>No account yet?</span>
          <AuthLink href="/register">Create one</AuthLink>
        </AuthFooterLinks>
        <AuthFooterLinks>
          <span>Lost access?</span>
          <AuthLink href="/recover-account">Recover your account</AuthLink>
        </AuthFooterLinks>
      </AuthPanel>
    </AuthShell>
  );
}

function RegistrationShell() {
  return (
    <AuthShell
      intro={
        <AuthIntro
          footer="Your tastings stay yours — export them at any time."
          points={[
            "Log a dram in three taps, then add a note when you want one.",
            "Keep the bottles you own, have open, or are hunting.",
            "Record a missing bottling and publish it to the shared database.",
          ]}
          title="An account is a shelf and a record."
        />
      }
    >
      <AuthPanel
        description="Two fields and a passkey. No password to remember."
        title="Create an account"
      >
        <AuthActionStack>
          <ButtonLink
            align="start"
            fullWidth
            href="/register"
            size="lg"
            variant="tonal"
          >
            Sign up with Google
          </ButtonLink>
          <ButtonLink
            align="start"
            fullWidth
            href="/register"
            size="lg"
            variant="accent"
          >
            Create account with a passkey
          </ButtonLink>
        </AuthActionStack>
      </AuthPanel>
    </AuthShell>
  );
}

const meta = {
  title: "Patterns/Authentication/Auth Shell",
  component: AuthShell,
  args: {
    children: null,
    intro: null,
  },
  argTypes: {
    children: { control: false },
    intro: { control: false },
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AuthShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignIn: Story = { render: () => <SignInShell /> };

export const Registration: Story = { render: () => <RegistrationShell /> };

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button, ButtonLink } from "../components";
import {
  AuthenticationActions,
  AuthenticationDivider,
  AuthenticationIntro,
  AuthenticationLayout,
  AuthenticationLink,
  AuthenticationLinks,
  AuthenticationPanel,
} from "./authentication.stylex";

function SignInShell() {
  return (
    <AuthenticationLayout
      intro={
        <AuthenticationIntro
          artwork={{
            alt: "",
            src: "/assets/auth-discovery-illustration.webp",
          }}
          description="Sign in to record what you pour, keep your library, and see critic and community views side by side."
          facts={[
            { label: "Bottles", value: "28,430" },
            { label: "Distillers", value: "2,410" },
            { label: "Brands", value: "3,980" },
            { label: "Bottlers", value: "1,125" },
            { label: "Blenders", value: "420" },
          ]}
          footer={
            <AuthenticationLink href="/bottles">
              Browse without an account →
            </AuthenticationLink>
          }
          title="Every bottle, every review, in one place."
        />
      }
    >
      <AuthenticationPanel
        description="A passkey is fastest. Email works everywhere."
        title="Sign in"
      >
        <AuthenticationActions>
          <Button align="start" fullWidth size="lg" variant="tonal">
            Continue with a passkey
          </Button>
          <Button align="start" fullWidth size="lg" variant="tonal">
            Continue with Google
          </Button>
          <Button align="start" fullWidth size="lg" variant="tonal">
            Continue with email
          </Button>
        </AuthenticationActions>
        <AuthenticationDivider />
        <AuthenticationLinks>
          <span>No account yet?</span>
          <AuthenticationLink href="/register">Create one</AuthenticationLink>
        </AuthenticationLinks>
        <AuthenticationLinks>
          <span>Lost access?</span>
          <AuthenticationLink href="/recover-account">
            Recover your account
          </AuthenticationLink>
        </AuthenticationLinks>
      </AuthenticationPanel>
    </AuthenticationLayout>
  );
}

function RegistrationShell() {
  return (
    <AuthenticationLayout
      intro={
        <AuthenticationIntro
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
      <AuthenticationPanel
        description="Two fields and a passkey. No password to remember."
        title="Create an account"
      >
        <AuthenticationActions>
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
        </AuthenticationActions>
      </AuthenticationPanel>
    </AuthenticationLayout>
  );
}

const meta = {
  title: "Components/Layout/Authentication Layout",
  component: AuthenticationLayout,
  args: {
    children: null,
    intro: null,
  },
  argTypes: {
    children: { control: false },
    intro: { control: false },
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AuthenticationLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignIn: Story = { render: () => <SignInShell /> };

export const Registration: Story = { render: () => <RegistrationShell /> };

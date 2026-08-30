"use client";

import { Button, Field, TextInput } from "@peated/web/components";
import GoogleLoginButton from "@peated/web/components/googleLoginButton";
import {
  AuthenticationActions,
  AuthenticationCard,
  AuthenticationDivider,
  AuthenticationLink,
  AuthenticationLinks,
  AuthenticationNotice,
  AuthenticationPanel,
  AuthenticationTextButton,
} from "@peated/web/components/pages/authentication.stylex";
import PasskeyLoginButton from "@peated/web/components/passkeyLoginButton";
import config from "@peated/web/config";
import { authenticate, authenticateForm } from "@peated/web/lib/auth.actions";
import { Mail } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

function AccountLinks({ email }: { email?: string | null }) {
  const recoveryHref = email
    ? `/recover-account?email=${encodeURIComponent(email)}`
    : "/recover-account";

  return (
    <>
      <AuthenticationDivider />
      <AuthenticationLinks>
        <span>No account yet?</span>
        <AuthenticationLink href="/register">Create one</AuthenticationLink>
        <span>·</span>
        <AuthenticationLink href={recoveryHref}>
          Recover your account
        </AuthenticationLink>
      </AuthenticationLinks>
    </>
  );
}

function EmailForm({ showPassword }: { showPassword: boolean }) {
  const { pending } = useFormStatus();
  const [showPasswordField, setShowPasswordField] = useState(showPassword);
  const searchParams = useSearchParams();

  return (
    <AuthenticationActions>
      <AuthenticationCard>
        <input
          type="hidden"
          name="redirectTo"
          value={searchParams.get("redirectTo") ?? "/"}
        />
        <Field htmlFor="login-email" label="Email" required>
          <TextInput
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            autoFocus
            defaultValue={searchParams.get("email") ?? ""}
          />
        </Field>
        {showPasswordField ? (
          <Field htmlFor="login-password" label="Password" required>
            <TextInput
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
        ) : (
          <AuthenticationTextButton
            type="button"
            onClick={() => setShowPasswordField(true)}
          >
            Or sign in with a password
          </AuthenticationTextButton>
        )}
      </AuthenticationCard>
      <Button
        align="start"
        fullWidth
        loading={pending}
        size="lg"
        type="submit"
        variant="accent"
      >
        {showPasswordField ? "Sign in" : "Send me a link"}
      </Button>
    </AuthenticationActions>
  );
}

export default function LoginForm() {
  const [result, formAction] = useActionState(authenticateForm, undefined);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  if (result?.magicLink) {
    return (
      <AuthenticationPanel
        description="Use the secure link we sent to finish signing in."
        title="Check your email"
      >
        <AuthenticationNotice>
          The link is on its way{email ? ` to ${email}` : ""}.
        </AuthenticationNotice>
        <AccountLinks email={email} />
      </AuthenticationPanel>
    );
  }

  if (showEmailForm) {
    return (
      <AuthenticationPanel
        back={
          <AuthenticationTextButton
            type="button"
            onClick={() => setShowEmailForm(false)}
          >
            ← Other ways to sign in
          </AuthenticationTextButton>
        }
        description="We send a link — no password unless you want one."
        title="Sign in with email"
      >
        {result?.error ? (
          <AuthenticationNotice>{result.error}</AuthenticationNotice>
        ) : null}
        <form action={formAction}>
          <EmailForm showPassword={false} />
        </form>
        <AccountLinks email={email} />
      </AuthenticationPanel>
    );
  }

  return (
    <AuthenticationPanel
      description="A passkey is fastest. Email works everywhere."
      title="Sign in"
    >
      {result?.error ? (
        <AuthenticationNotice>{result.error}</AuthenticationNotice>
      ) : null}
      <AuthenticationActions>
        <PasskeyLoginButton action={authenticate} />
        {config.GOOGLE_CLIENT_ID ? (
          <GoogleLoginButton action={authenticate} />
        ) : null}
        <Button
          align="start"
          fullWidth
          onClick={() => setShowEmailForm(true)}
          size="lg"
          variant="tonal"
        >
          <Mail aria-hidden="true" size={17} />
          Continue with email
        </Button>
      </AuthenticationActions>
      <AccountLinks email={email} />
    </AuthenticationPanel>
  );
}

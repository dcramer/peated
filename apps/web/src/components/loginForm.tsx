"use client";

import {
  Button,
  Field,
  TextInput,
} from "@peated/web/components/designSystem/components";
import {
  AuthActionStack,
  AuthDivider,
  AuthFooterLinks,
  AuthFormSurface,
  AuthLink,
  AuthNotice,
  AuthPanel,
  AuthTextButton,
} from "@peated/web/components/designSystem/patterns/authShell.stylex";
import GoogleLoginButton from "@peated/web/components/googleLoginButton";
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
      <AuthDivider />
      <AuthFooterLinks>
        <span>No account yet?</span>
        <AuthLink href="/register">Create one</AuthLink>
        <span>·</span>
        <AuthLink href={recoveryHref}>Recover your account</AuthLink>
      </AuthFooterLinks>
    </>
  );
}

function EmailForm({ showPassword }: { showPassword: boolean }) {
  const { pending } = useFormStatus();
  const [showPasswordField, setShowPasswordField] = useState(showPassword);
  const searchParams = useSearchParams();

  return (
    <AuthActionStack>
      <AuthFormSurface>
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
          <AuthTextButton
            type="button"
            onClick={() => setShowPasswordField(true)}
          >
            Or sign in with a password
          </AuthTextButton>
        )}
      </AuthFormSurface>
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
    </AuthActionStack>
  );
}

export default function LoginForm() {
  const [result, formAction] = useActionState(authenticateForm, undefined);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  if (result?.magicLink) {
    return (
      <AuthPanel
        description="Use the secure link we sent to finish signing in."
        title="Check your email"
      >
        <AuthNotice>
          The link is on its way{email ? ` to ${email}` : ""}.
        </AuthNotice>
        <AccountLinks email={email} />
      </AuthPanel>
    );
  }

  if (showEmailForm) {
    return (
      <AuthPanel
        back={
          <AuthTextButton type="button" onClick={() => setShowEmailForm(false)}>
            ← Other ways to sign in
          </AuthTextButton>
        }
        description="We send a link — no password unless you want one."
        title="Sign in with email"
      >
        {result?.error ? <AuthNotice>{result.error}</AuthNotice> : null}
        <form action={formAction}>
          <EmailForm showPassword={false} />
        </form>
        <AccountLinks email={email} />
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      description="A passkey is fastest. Email works everywhere."
      title="Sign in"
    >
      {result?.error ? <AuthNotice>{result.error}</AuthNotice> : null}
      <AuthActionStack>
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
      </AuthActionStack>
      <AccountLinks email={email} />
    </AuthPanel>
  );
}

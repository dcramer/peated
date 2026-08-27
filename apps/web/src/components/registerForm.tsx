"use client";

import {
  ButtonLink,
  Checkbox,
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
import PasskeyRegisterButton from "@peated/web/components/passkeyRegisterButton";
import config from "@peated/web/config";
import { authenticate, register } from "@peated/web/lib/auth.actions";
import type { RegistrationConflictField } from "@peated/web/lib/registration";
import { useState } from "react";

export default function RegisterForm() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [tosAccepted, setTosAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictField, setConflictField] =
    useState<RegistrationConflictField | null>(null);

  const clearFeedback = () => {
    setError(null);
    setConflictField(null);
  };

  if (conflictField === "email") {
    return (
      <AuthPanel
        description="Sign in with an existing passkey, choose another method, or recover access."
        title="That email already has an account"
      >
        {error ? <AuthNotice>{error}</AuthNotice> : null}
        <AuthActionStack>
          <PasskeyLoginButton action={authenticate} />
          <ButtonLink
            align="start"
            fullWidth
            href={`/login?email=${encodeURIComponent(email)}`}
            size="lg"
            variant="tonal"
          >
            Other sign-in options
          </ButtonLink>
        </AuthActionStack>
        <AuthDivider />
        <AuthFooterLinks>
          <AuthLink
            href={`/recover-account?email=${encodeURIComponent(email)}`}
          >
            Recover your account
          </AuthLink>
          <span>·</span>
          <AuthTextButton type="button" onClick={clearFeedback}>
            Use a different email
          </AuthTextButton>
        </AuthFooterLinks>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      description="Two fields and a passkey. No password to remember."
      title="Create an account"
    >
      {error ? <AuthNotice>{error}</AuthNotice> : null}
      <AuthActionStack>
        {config.GOOGLE_CLIENT_ID ? (
          <>
            <GoogleLoginButton
              action={authenticate}
              title="Sign up with Google"
            />
            <AuthDivider label="or" />
          </>
        ) : null}
        <AuthFormSurface>
          <Field htmlFor="register-email" label="Email" required>
            <TextInput
              autoComplete="email"
              autoFocus
              id="register-email"
              name="email"
              onChange={(event) => {
                setEmail(event.currentTarget.value);
                clearFeedback();
              }}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </Field>
          <Field
            hint="Shown on every tasting you log."
            htmlFor="register-username"
            label="Username"
            required
          >
            <TextInput
              autoComplete="username"
              id="register-username"
              name="username"
              onChange={(event) => {
                setUsername(event.currentTarget.value);
                clearFeedback();
              }}
              placeholder="caskstrength_k"
              required
              value={username}
            />
          </Field>
          <Checkbox
            checked={tosAccepted}
            label={
              <>
                I agree to the{" "}
                <AuthLink href="/terms">Terms of Service</AuthLink>.
              </>
            }
            name="tosAccepted"
            onChange={(event) => setTosAccepted(event.currentTarget.checked)}
            required
          />
        </AuthFormSurface>
        <PasskeyRegisterButton
          action={register}
          email={email}
          onConflict={(field, message) => {
            setConflictField(field);
            setError(message);
          }}
          onError={(message) => {
            setConflictField(null);
            setError(message);
          }}
          tosAccepted={tosAccepted}
          username={username}
        />
      </AuthActionStack>
      <AuthDivider />
      <AuthFooterLinks>
        <span>Already have an account?</span>
        <AuthLink href="/login">Sign in</AuthLink>
      </AuthFooterLinks>
    </AuthPanel>
  );
}

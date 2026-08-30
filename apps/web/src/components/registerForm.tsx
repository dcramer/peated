"use client";

import { ButtonLink, Checkbox, Field, TextInput } from "@peated/web/components";
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
      <AuthenticationPanel
        description="Sign in with an existing passkey, choose another method, or recover access."
        title="That email already has an account"
      >
        {error ? <AuthenticationNotice>{error}</AuthenticationNotice> : null}
        <AuthenticationActions>
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
        </AuthenticationActions>
        <AuthenticationDivider />
        <AuthenticationLinks>
          <AuthenticationLink
            href={`/recover-account?email=${encodeURIComponent(email)}`}
          >
            Recover your account
          </AuthenticationLink>
          <span>·</span>
          <AuthenticationTextButton type="button" onClick={clearFeedback}>
            Use a different email
          </AuthenticationTextButton>
        </AuthenticationLinks>
      </AuthenticationPanel>
    );
  }

  return (
    <AuthenticationPanel
      description="Two fields and a passkey. No password to remember."
      title="Create an account"
    >
      {error ? <AuthenticationNotice>{error}</AuthenticationNotice> : null}
      <AuthenticationActions>
        {config.GOOGLE_CLIENT_ID ? (
          <>
            <GoogleLoginButton
              action={authenticate}
              title="Sign up with Google"
            />
            <AuthenticationDivider label="or" />
          </>
        ) : null}
        <AuthenticationCard>
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
                <AuthenticationLink href="/terms">
                  Terms of Service
                </AuthenticationLink>
                .
              </>
            }
            name="tosAccepted"
            onChange={(event) => setTosAccepted(event.currentTarget.checked)}
            required
          />
        </AuthenticationCard>
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
      </AuthenticationActions>
      <AuthenticationDivider />
      <AuthenticationLinks>
        <span>Already have an account?</span>
        <AuthenticationLink href="/login">Sign in</AuthenticationLink>
      </AuthenticationLinks>
    </AuthenticationPanel>
  );
}

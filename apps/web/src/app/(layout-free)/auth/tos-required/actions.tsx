"use client";

import { Button, Checkbox } from "@peated/web/components";
import {
  AuthenticationActions,
  AuthenticationCard,
  AuthenticationLink,
  AuthenticationNotice,
} from "@peated/web/components/pages/authentication.stylex";
import { acceptTosForm, logoutForm } from "@peated/web/lib/auth.actions";
import { useActionState, useState } from "react";

export default function Actions({ redirectTo }: { redirectTo: string }) {
  const [accepted, setAccepted] = useState(false);
  const [acceptState, acceptAction] = useActionState(acceptTosForm, undefined);
  const [, logoutAction] = useActionState(logoutForm, undefined);

  return (
    <AuthenticationActions>
      {acceptState?.error ? (
        <AuthenticationNotice>{acceptState.error}</AuthenticationNotice>
      ) : null}
      <form action={acceptAction}>
        <AuthenticationActions>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <AuthenticationCard>
            <Checkbox
              checked={accepted}
              label={
                <>
                  I agree to the updated{" "}
                  <AuthenticationLink href="/terms">
                    Terms of Service
                  </AuthenticationLink>
                  .
                </>
              }
              name="tosAccepted"
              onChange={(event) => setAccepted(event.currentTarget.checked)}
              required
            />
          </AuthenticationCard>
          <Button
            align="start"
            disabled={!accepted}
            fullWidth
            size="lg"
            type="submit"
            variant="accent"
          >
            Accept and continue
          </Button>
        </AuthenticationActions>
      </form>
      <form action={logoutAction}>
        <Button align="start" fullWidth size="lg" type="submit" variant="tonal">
          Sign out
        </Button>
      </form>
    </AuthenticationActions>
  );
}

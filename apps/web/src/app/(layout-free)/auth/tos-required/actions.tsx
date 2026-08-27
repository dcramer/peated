"use client";

import {
  Button,
  Checkbox,
} from "@peated/web/components/designSystem/components";
import {
  AuthActionStack,
  AuthFormSurface,
  AuthLink,
  AuthNotice,
} from "@peated/web/components/designSystem/patterns/authShell.stylex";
import { acceptTosForm, logoutForm } from "@peated/web/lib/auth.actions";
import { useActionState, useState } from "react";

export default function Actions({ redirectTo }: { redirectTo: string }) {
  const [accepted, setAccepted] = useState(false);
  const [acceptState, acceptAction] = useActionState(acceptTosForm, undefined);
  const [, logoutAction] = useActionState(logoutForm, undefined);

  return (
    <AuthActionStack>
      {acceptState?.error ? <AuthNotice>{acceptState.error}</AuthNotice> : null}
      <form action={acceptAction}>
        <AuthActionStack>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <AuthFormSurface>
            <Checkbox
              checked={accepted}
              label={
                <>
                  I agree to the updated{" "}
                  <AuthLink href="/terms">Terms of Service</AuthLink>.
                </>
              }
              name="tosAccepted"
              onChange={(event) => setAccepted(event.currentTarget.checked)}
              required
            />
          </AuthFormSurface>
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
        </AuthActionStack>
      </form>
      <form action={logoutAction}>
        <Button align="start" fullWidth size="lg" type="submit" variant="tonal">
          Sign out
        </Button>
      </form>
    </AuthActionStack>
  );
}

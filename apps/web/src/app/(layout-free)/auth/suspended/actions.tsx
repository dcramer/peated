"use client";

import { useMutation } from "@tanstack/react-query";
import { useActionState } from "react";

import { AccountDeletionSection } from "@peated/web/components/accountDeletionSection";
import { Button } from "@peated/web/components/button.stylex";
import {
  AuthenticationActions,
  AuthenticationNotice,
} from "@peated/web/components/pages/authentication.stylex";
import useAuth from "@peated/web/hooks/useAuth";
import { logoutForm, updateSession } from "@peated/web/lib/auth.actions";
import { useORPC } from "@peated/web/lib/orpc/context";

export default function Actions() {
  const orpc = useORPC();
  const { user, setUser } = useAuth();
  const deleteAccount = useMutation(orpc.users.delete.mutationOptions());
  const cancelDeletion = useMutation(
    orpc.users.deletionCancel.mutationOptions(),
  );
  const [, logoutAction] = useActionState(logoutForm, undefined);

  if (!user) return null;

  return (
    <AuthenticationActions>
      {user.suspensionReason ? (
        <AuthenticationNotice>
          Reason: {user.suspensionReason}
        </AuthenticationNotice>
      ) : null}
      <AccountDeletionSection
        deletionScheduledAt={user.deletionScheduledAt}
        onDelete={async () => {
          setUser(await deleteAccount.mutateAsync({ user: "me" }));
          await updateSession();
        }}
        onKeep={async () => {
          setUser(await cancelDeletion.mutateAsync({ user: "me" }));
          await updateSession();
        }}
        username={user.username}
      />
      <form action={logoutAction}>
        <Button align="start" fullWidth size="lg" type="submit" variant="tonal">
          Sign out
        </Button>
      </form>
    </AuthenticationActions>
  );
}

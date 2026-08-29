"use client";

import {
  Button,
  FormActions,
  FormNotice,
  FormStack,
  IconButton,
  ItemList,
  ItemRow,
  TextInput,
} from "@peated/web/components/designSystem/components";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { startRegistration } from "@simplewebauthn/browser";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Pencil, Smartphone, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PasskeyManager() {
  const orpc = useORPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  const [isRegistering, setIsRegistering] = useState(false);
  const [editingId, setEditingId] = useState<number>();
  const [editingName, setEditingName] = useState("");
  const { data: passkeys, isLoading } = useQuery(
    orpc.auth.passkey.list.queryOptions({ input: undefined }),
  );
  const registerChallenge = useMutation(
    orpc.auth.passkey.registerChallenge.mutationOptions(),
  );
  const registerVerify = useMutation(
    orpc.auth.passkey.registerVerify.mutationOptions(),
  );
  const deletePasskey = useMutation(orpc.auth.passkey.delete.mutationOptions());
  const updatePasskey = useMutation(orpc.auth.passkey.update.mutationOptions());

  async function addPasskey() {
    if (!globalThis.PublicKeyCredential) {
      router.push("/browser-not-supported");
      return;
    }

    setError(undefined);
    setIsRegistering(true);
    try {
      const { options, signedChallenge } = await registerChallenge.mutateAsync(
        {},
      );
      const response = await startRegistration({ optionsJSON: options });
      await registerVerify.mutateAsync({ response, signedChallenge });
      await queryClient.invalidateQueries({
        queryKey: orpc.auth.passkey.list.key({ input: undefined }),
      });
    } catch (caught) {
      logError(caught, { context: "passkey_add" });
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to add this passkey.",
      );
    } finally {
      setIsRegistering(false);
    }
  }

  async function removePasskey(passkeyId: number) {
    const lastPasskey = passkeys?.results.length === 1;
    const confirmed = confirm(
      lastPasskey
        ? "This is your last passkey. Delete it only if you can still sign in with a password."
        : "Delete this passkey? You will no longer be able to use it to sign in.",
    );
    if (!confirmed) return;

    setError(undefined);
    try {
      await deletePasskey.mutateAsync({ passkeyId });
      await queryClient.invalidateQueries({
        queryKey: orpc.auth.passkey.list.key({ input: undefined }),
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to delete passkey.",
      );
    }
  }

  async function savePasskey(passkeyId: number) {
    setError(undefined);
    try {
      await updatePasskey.mutateAsync({
        nickname: editingName.trim() || undefined,
        passkeyId,
      });
      await queryClient.invalidateQueries({
        queryKey: orpc.auth.passkey.list.key({ input: undefined }),
      });
      setEditingId(undefined);
      setEditingName("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to rename passkey.",
      );
    }
  }

  if (isLoading) return <FormNotice>Loading passkeys…</FormNotice>;

  return (
    <FormStack>
      {error ? <FormNotice>{error}</FormNotice> : null}
      {passkeys?.results.length ? (
        <ItemList ariaLabel="Your passkeys">
          {passkeys.results.map((passkey) => {
            const editing = editingId === passkey.id;
            return (
              <ItemRow
                key={passkey.id}
                action={
                  editing ? (
                    <FormActions>
                      <Button
                        loading={updatePasskey.isPending}
                        onClick={() => void savePasskey(passkey.id)}
                        size="sm"
                        variant="accent"
                      >
                        Save
                      </Button>
                      <Button
                        onClick={() => setEditingId(undefined)}
                        size="sm"
                        variant="text"
                      >
                        Cancel
                      </Button>
                    </FormActions>
                  ) : (
                    <FormActions>
                      <IconButton
                        icon={<Pencil aria-hidden="true" size={15} />}
                        label={`Rename ${passkey.nickname || "passkey"}`}
                        onClick={() => {
                          setEditingId(passkey.id);
                          setEditingName(passkey.nickname || "");
                        }}
                        size="sm"
                        variant="text"
                      />
                      <IconButton
                        disabled={deletePasskey.isPending}
                        icon={<Trash2 aria-hidden="true" size={15} />}
                        label={`Delete ${passkey.nickname || "passkey"}`}
                        onClick={() => void removePasskey(passkey.id)}
                        size="sm"
                        variant="text"
                      />
                    </FormActions>
                  )
                }
                leading={getTransportIcon(passkey.transports)}
                metadata={
                  passkey.lastUsedAt
                    ? `Last used ${formatDate(passkey.lastUsedAt)}`
                    : `Added ${formatDate(passkey.createdAt)}`
                }
                title={
                  editing ? (
                    <TextInput
                      aria-label="Passkey name"
                      autoFocus
                      onChange={(event) =>
                        setEditingName(event.currentTarget.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void savePasskey(passkey.id);
                        if (event.key === "Escape") setEditingId(undefined);
                      }}
                      value={editingName}
                    />
                  ) : (
                    passkey.nickname || "Unnamed passkey"
                  )
                }
              />
            );
          })}
        </ItemList>
      ) : (
        <FormNotice>
          No passkeys yet. Add one to sign in with your fingerprint, face, or
          device PIN.
        </FormNotice>
      )}
      <FormActions>
        <Button
          loading={isRegistering}
          loadingLabel="Adding passkey…"
          onClick={() => void addPasskey()}
          variant="accent"
        >
          Add passkey
        </Button>
      </FormActions>
    </FormStack>
  );
}

function getTransportIcon(transports: string[] | null) {
  return transports?.includes("internal") ? (
    <Smartphone aria-hidden="true" size={18} />
  ) : (
    <KeyRound aria-hidden="true" size={18} />
  );
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

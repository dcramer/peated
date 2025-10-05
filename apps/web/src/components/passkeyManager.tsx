"use client";

import Alert from "@peated/web/components/alert";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { useORPC } from "@peated/web/lib/orpc/context";
import { startRegistration } from "@simplewebauthn/browser";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { KeyRound, Pencil, Smartphone, Trash2 } from "lucide-react";
import { useState } from "react";

export default function PasskeyManager() {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>("");

  const { data: passkeys, isLoading } = useQuery(
    orpc.auth.passkey.list.queryOptions({
      input: undefined,
    }),
  );

  const registerChallengeMutation = useMutation(
    orpc.auth.passkey.registerChallenge.mutationOptions(),
  );
  const registerVerifyMutation = useMutation(
    orpc.auth.passkey.registerVerify.mutationOptions(),
  );
  const deletePasskeyMutation = useMutation(
    orpc.auth.passkey.delete.mutationOptions(),
  );
  const updatePasskeyMutation = useMutation(
    orpc.auth.passkey.update.mutationOptions(),
  );

  const handleAddPasskey = async () => {
    setError(null);
    setIsRegistering(true);

    try {
      // Get registration options from server
      const { options, signedChallenge } =
        await registerChallengeMutation.mutateAsync({});

      // Start WebAuthn registration
      const response = await startRegistration(options);

      // Verify registration with server
      await registerVerifyMutation.mutateAsync({
        response,
        signedChallenge,
        nickname: `Passkey added ${new Date().toLocaleDateString()}`,
      });

      // Refresh passkeys list
      queryClient.invalidateQueries({
        queryKey: orpc.auth.passkey.list.key({ input: undefined }),
      });
    } catch (err: any) {
      console.error("Passkey registration error:", err);
      setError(err.message || "Failed to add passkey. Please try again.");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDeletePasskey = async (passkeyId: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this passkey? You won't be able to use it to sign in anymore.",
      )
    ) {
      return;
    }

    try {
      await deletePasskeyMutation.mutateAsync({ passkeyId });
      queryClient.invalidateQueries({
        queryKey: orpc.auth.passkey.list.key({ input: undefined }),
      });
    } catch (err: any) {
      setError(err.message || "Failed to delete passkey");
    }
  };

  const handleEditPasskey = (passkeyId: number, currentName: string) => {
    setEditingId(passkeyId);
    setEditingName(currentName || "");
  };

  const handleSavePasskey = async (passkeyId: number) => {
    try {
      await updatePasskeyMutation.mutateAsync({
        passkeyId,
        nickname: editingName.trim() || undefined,
      });
      queryClient.invalidateQueries({
        queryKey: orpc.auth.passkey.list.key({ input: undefined }),
      });
      setEditingId(null);
      setEditingName("");
    } catch (err: any) {
      setError(err.message || "Failed to update passkey");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const getTransportIcon = (transports: string[] | null) => {
    if (!transports || transports.length === 0)
      return <KeyRound className="h-5 w-5" />;
    if (transports.includes("internal"))
      return <Smartphone className="h-5 w-5" />;
    return <KeyRound className="h-5 w-5" />;
  };

  return (
    <>
      {error && (
        <Alert className="mb-4" type="error">
          {error}
        </Alert>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="text-muted">Loading passkeys...</div>
        ) : passkeys?.results && passkeys.results.length > 0 ? (
          passkeys.results.map((passkey) => (
            <div
              key={passkey.id}
              className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 p-4"
            >
              <div className="flex flex-1 items-center gap-3">
                <div className="text-slate-400">
                  {getTransportIcon(passkey.transports)}
                </div>
                <div className="flex-1">
                  {editingId === passkey.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSavePasskey(passkey.id);
                        } else if (e.key === "Escape") {
                          handleCancelEdit();
                        }
                      }}
                      className="w-full rounded bg-slate-900 px-2 py-1 text-sm font-medium"
                      placeholder="Passkey name"
                      autoFocus
                    />
                  ) : (
                    <div className="font-medium">
                      {passkey.nickname || "Unnamed Passkey"}
                    </div>
                  )}
                  <div className="text-sm text-slate-400">
                    {passkey.lastUsedAt
                      ? `Last used ${formatDistanceToNow(new Date(passkey.lastUsedAt))} ago`
                      : `Added ${formatDistanceToNow(new Date(passkey.createdAt))} ago`}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {editingId === passkey.id ? (
                  <>
                    <Button
                      color="primary"
                      onClick={() => handleSavePasskey(passkey.id)}
                      disabled={updatePasskeyMutation.isPending}
                    >
                      Save
                    </Button>
                    <Button color="default" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      color="default"
                      onClick={() =>
                        handleEditPasskey(passkey.id, passkey.nickname || "")
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      color="default"
                      onClick={() => handleDeletePasskey(passkey.id)}
                      disabled={deletePasskeyMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        ) : (
          <EmptyActivity>
            You haven't added any passkeys yet. Passkeys let you sign in
            securely using your fingerprint, face, or device PIN.
          </EmptyActivity>
        )}

        <Button
          onClick={handleAddPasskey}
          disabled={isRegistering}
          color="highlight"
          fullWidth
        >
          {isRegistering ? "Adding Passkey..." : "Add Passkey"}
        </Button>
      </div>
    </>
  );
}

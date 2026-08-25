"use client";

import type { Outputs } from "@peated/server/orpc/router";
import Alert from "@peated/web/components/alert";
import Button from "@peated/web/components/button";
import ConfirmationButton from "@peated/web/components/confirmationButton";
import { useFlashMessages } from "@peated/web/components/flash";
import Heading from "@peated/web/components/heading";
import TextField from "@peated/web/components/textField";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

type Barcode = Outputs["bottles"]["details"]["barcodes"][number];

export function BottleBarcodeItems({
  barcodes,
  onRemove,
  removing = false,
}: {
  barcodes: readonly Barcode[];
  onRemove?: (barcode: Barcode) => void;
  removing?: boolean;
}) {
  return (
    <ul className="mb-4 space-y-2">
      {barcodes.map((barcode) => (
        <li
          key={barcode.value}
          className="flex items-center justify-between gap-4 rounded border border-slate-800 bg-slate-900 px-3 py-2"
        >
          <div>
            <div className="font-mono text-sm text-white">{barcode.value}</div>
            {barcode.volume !== null ? (
              <div className="text-muted text-sm">
                {barcode.volume} mL package
              </div>
            ) : null}
          </div>
          {onRemove ? (
            <ConfirmationButton
              className="text-muted text-sm underline hover:text-white"
              disabled={removing}
              onContinue={() => onRemove(barcode)}
              confirmationTitle="Remove barcode"
              confirmationMessage={`Remove ${barcode.value}? Peated will stop using this barcode to connect store listings to this product.`}
              continueLabel="Remove barcode"
            >
              Remove
            </ConfirmationButton>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default function BottleBarcodes({
  bottleId,
  barcodes,
}: {
  bottleId: number;
  barcodes: readonly Barcode[];
}) {
  const { user } = useAuth();
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { flash } = useFlashMessages();
  const [showForm, setShowForm] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [packageSize, setPackageSize] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canEdit = !!(user?.mod || user?.admin);

  const addMutation = useMutation(orpc.bottleBarcodes.upsert.mutationOptions());
  const removeMutation = useMutation(
    orpc.bottleBarcodes.delete.mutationOptions(),
  );
  const bottleDetailsKey = orpc.bottles.details.key({
    input: { bottle: bottleId },
    type: "query",
  });

  if (!barcodes.length && !canEdit) return null;

  const refreshBottle = () =>
    queryClient.invalidateQueries({ queryKey: bottleDetailsKey });

  const addBarcode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const volume = packageSize ? Number(packageSize) : null;
    if (volume !== null && (!Number.isInteger(volume) || volume <= 0)) {
      setError("Package size must be a positive whole number.");
      return;
    }

    try {
      await addMutation.mutateAsync({
        bottle: bottleId,
        barcode,
        volume,
      });
      await refreshBottle();
      setBarcode("");
      setPackageSize("");
      setShowForm(false);
      flash("Barcode added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add barcode.");
    }
  };

  const removeBarcode = async (item: Barcode) => {
    setError(null);
    try {
      await removeMutation.mutateAsync({ barcode: item.value });
      await refreshBottle();
      flash("Barcode removed.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to remove barcode.",
      );
    }
  };

  return (
    <section className="my-6">
      <Heading as="h3">Product barcodes</Heading>
      {barcodes.length ? (
        <BottleBarcodeItems
          barcodes={barcodes}
          onRemove={canEdit ? removeBarcode : undefined}
          removing={removeMutation.isPending}
        />
      ) : (
        <p className="text-muted mb-4">No barcodes have been added.</p>
      )}

      {error ? (
        <div className="mb-4">
          <Alert noMargin>{error}</Alert>
        </div>
      ) : null}

      {canEdit && showForm ? (
        <form
          className="flex flex-col border border-slate-800 sm:flex-row sm:items-start"
          onSubmit={addBarcode}
        >
          <TextField
            name="barcode"
            label="Barcode number"
            helpText="Enter the number printed below the barcode."
            inputMode="numeric"
            autoComplete="off"
            required
            value={barcode}
            onChange={(event) => {
              if ("value" in event.currentTarget) {
                setBarcode(String(event.currentTarget.value));
              }
            }}
            className="flex-1"
          />
          <TextField
            name="package-size"
            label="Package size (mL)"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={packageSize}
            onChange={(event) => {
              if ("value" in event.currentTarget) {
                setPackageSize(String(event.currentTarget.value));
              }
            }}
            className="sm:w-48"
          />
          <div className="flex gap-2 p-4 sm:mt-5">
            <Button
              type="submit"
              color="primary"
              disabled={!barcode.trim() || addMutation.isPending}
              loading={addMutation.isPending}
            >
              Add barcode
            </Button>
            <Button
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : canEdit ? (
        <Button onClick={() => setShowForm(true)} size="small">
          Add barcode
        </Button>
      ) : null}
    </section>
  );
}

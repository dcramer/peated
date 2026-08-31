"use client";

import * as stylex from "@stylexjs/stylex";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";

import { space } from "../styles/tokens.stylex";
import { Button } from "./button.stylex";
import { Chip } from "./chip.stylex";
import { DataTable, type DataTableColumn } from "./dataTable.stylex";
import { Field, TextInput, ValidationMessage } from "./field.stylex";

export type AliasManagerItem = {
  badge?: string;
  canDelete?: boolean;
  created: ReactNode;
  name: string;
};

export type AliasManagerProps = {
  aliases: readonly AliasManagerItem[];
  canEdit?: boolean;
  onCreate?: (name: string) => Promise<void>;
  onDelete?: (name: string) => Promise<void>;
};

export function AliasManager({
  aliases,
  canEdit = false,
  onCreate,
  onDelete,
}: AliasManagerProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const columns: DataTableColumn<AliasManagerItem>[] = [
    {
      cell: (item) => (
        <span {...stylex.props(styles.name)}>
          <span>{item.name}</span>
          {item.badge ? <Chip variant="tinted">{item.badge}</Chip> : null}
        </span>
      ),
      header: "Name",
      key: "name",
    },
    {
      cell: (item) => item.created,
      header: "Created",
      key: "created",
      priority: "secondary",
    },
    ...(canEdit && onDelete
      ? ([
          {
            align: "right",
            cell: (item: AliasManagerItem) =>
              item.canDelete === false ? null : (
                <Button
                  disabled={pending !== null}
                  loading={pending === item.name}
                  onClick={() => void remove(item.name)}
                  size="sm"
                  variant="text"
                >
                  Delete
                </Button>
              ),
            header: "",
            key: "delete",
          },
        ] satisfies DataTableColumn<AliasManagerItem>[])
      : []),
  ];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = name.trim();
    if (!onCreate || !value || pending) return;

    setError(null);
    setPending("create");
    try {
      await onCreate(value);
      setName("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "We couldn't add that name.",
      );
    } finally {
      setPending(null);
    }
  }

  async function remove(value: string) {
    if (
      !onDelete ||
      pending ||
      !window.confirm(`Delete the name “${value}”?`)
    ) {
      return;
    }

    setError(null);
    setPending(value);
    try {
      await onDelete(value);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We couldn't delete that name.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div {...stylex.props(styles.manager)}>
      {canEdit && onCreate ? (
        <form onSubmit={submit} {...stylex.props(styles.form)}>
          <div {...stylex.props(styles.field)}>
            <Field htmlFor="alias-name" label="Other name">
              <TextInput
                id="alias-name"
                onChange={(event) => setName(event.currentTarget.value)}
                required
                value={name}
              />
            </Field>
          </div>
          <Button
            disabled={!name.trim()}
            loading={pending === "create"}
            size="md"
            type="submit"
            variant="accent"
          >
            Add name
          </Button>
        </form>
      ) : null}
      {error ? <ValidationMessage>{error}</ValidationMessage> : null}
      <DataTable
        caption="Other names"
        columns={columns}
        getKey={(item) => item.name}
        items={aliases}
      />
    </div>
  );
}

const styles = stylex.create({
  manager: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x4,
  },
  form: {
    display: "flex",
    maxWidth: "680px",
    alignItems: "flex-end",
    gap: space.x3,
  },
  field: { minWidth: 0, flex: 1 },
  name: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x2,
    flexWrap: "wrap",
  },
});

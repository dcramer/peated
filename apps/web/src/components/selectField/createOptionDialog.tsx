"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import { useEffect, useState } from "react";
import { Modal } from "../modal";
import type { CreateForm, Option } from "./types";

type OnSubmit<T> = (newOption: any) => void;

// TODO(dcramer): hitting escape doesnt do what you want here (it does nothing)
export default function CreateOptionDialog<T extends Option>({
  query = "",
  open,
  setOpen,
  onSubmit,
  render,
}: {
  query?: string;
  open: boolean;
  setOpen: (value: boolean) => void;
  onSubmit: OnSubmit<T>;
  render: CreateForm<T>;
}) {
  const [newOption, setNewOption] = useState<T>({
    id: null,
    name: "",
  } as T);

  useEffect(() => {
    setNewOption((data) => ({ ...data, name: toTitleCase(query) }));
  }, [query]);

  return (
    <Modal open={open} onClose={setOpen}>
      {render({
        onSubmit: (newOption: any) => {
          onSubmit(newOption);
          setNewOption({
            id: null,
            name: "",
          } as T);
          setOpen(false);
        },
        onClose: () => setOpen(false),
        data: newOption,
      })}
    </Modal>
  );
}

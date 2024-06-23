"use client";

import { Dialog } from "@headlessui/react";
import { useEffect, useState } from "react";

import { toTitleCase } from "@peated/server/lib/strings";

import type { CreateOptionForm, Option } from "./types";

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
  onSubmit: (newOption: T) => void;
  render: CreateOptionForm<T>;
}) {
  const [newOption, setNewOption] = useState<T>({
    id: null,
    name: "",
  } as T);

  useEffect(() => {
    setNewOption((data) => ({ ...data, name: toTitleCase(query) }));
  }, [query]);

  return (
    <Dialog open={open} as="div" className="dialog" onClose={setOpen}>
      <Dialog.Overlay className="fixed inset-0" />
      <Dialog.Panel className="dialog-panel flex items-center justify-center px-4 pb-4 pt-5 sm:p-6">
        {render({
          onSubmit: (...params) => {
            onSubmit(...params);
            setNewOption({
              id: null,
              name: "",
            } as T);
            setOpen(false);
          },
          onClose: () => setOpen(false),
          data: newOption,
          onFieldChange: (value) => {
            setNewOption({
              ...newOption,
              ...value,
            });
          },
        })}
      </Dialog.Panel>
    </Dialog>
  );
}

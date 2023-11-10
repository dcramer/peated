import { Dialog } from "@headlessui/react";
import { useEffect, useState } from "react";

import { toTitleCase } from "@peated/server/lib/strings";

import type { CreateOptionForm, Option } from "./types";

// TODO(dcramer): hitting escape doesnt do what you want here (it does nothing)
export default function CreateOptionDialog({
  query = "",
  open,
  setOpen,
  onSubmit,
  render,
}: {
  query?: string;
  open: boolean;
  setOpen: (value: boolean) => void;
  onSubmit: (newOption: Option) => void;
  render: CreateOptionForm;
}) {
  const [newOption, setNewOption] = useState<Option>({
    id: null,
    name: "",
  });

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
            });
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

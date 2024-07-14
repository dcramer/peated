"use client";

import { useEffect, useState } from "react";

import { toTitleCase } from "@peated/server/lib/strings";

import FormHeader from "../formHeader";
import LayoutModal from "../layoutModal";
import { Modal } from "../modal";
import type { CreateForm, Option } from "./types";

type OnSubmit<T> = (newOption: T) => void;

// TODO(dcramer): hitting escape doesnt do what you want here (it does nothing)
export default function CreateOptionDialog<T extends Option>({
  query = "",
  open,
  setOpen,
  onSubmit,
  render,
  title = "Add Option",
}: {
  query?: string;
  open: boolean;
  setOpen: (value: boolean) => void;
  onSubmit: OnSubmit<T>;
  render: CreateForm<T>;
  title?: string;
}) {
  const [newOption, setNewOption] = useState<T>({
    id: null,
    name: "",
  } as T);

  useEffect(() => {
    setNewOption((data) => ({ ...data, name: toTitleCase(query) }));
  }, [query]);

  const onSubmitHandler = () => {
    onSubmit(newOption);
    setNewOption({
      id: null,
      name: "",
    } as T);
    setOpen(false);
  };

  return (
    <Modal open={open} onClose={setOpen}>
      <LayoutModal
        header={
          <FormHeader
            title={title}
            onSave={onSubmitHandler}
            onClose={() => setOpen(false)}
          />
        }
      >
        {render({
          onSubmit: (newOption) => {
            onSubmit(newOption);
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
      </LayoutModal>
    </Modal>
  );
}

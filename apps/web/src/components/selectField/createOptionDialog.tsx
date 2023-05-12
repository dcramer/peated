import { Fragment, useState } from "react";

import { Dialog, Transition } from "@headlessui/react";

import Button from "../button";
import { OverlayTransition, PanelTransition } from "./transitions";
import { CreateOptionForm, Option } from "./types";

// TODO(dcramer): hitting escape doesnt do what you want here (it does nothing)
export default ({
  open,
  setOpen,
  onSubmit,
  render,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  onSubmit?: (newOption: Option) => void;
  render: CreateOptionForm;
}) => {
  const [newOption, setNewOption] = useState<Option>({
    id: null,
    name: "",
  });

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog
        as="div"
        className="fixed inset-0 z-10 min-h-screen overflow-y-auto"
        onClose={setOpen}
      >
        <div className="min-h-screen text-center">
          <OverlayTransition>
            <Dialog.Overlay className="fixed inset-0" />
          </OverlayTransition>

          <PanelTransition>
            <Dialog.Panel className="relative flex h-screen min-w-full transform items-center justify-center overflow-hidden bg-white px-4 pb-4 pt-5 text-left transition-all sm:p-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();

                  onSubmit && onSubmit({ ...newOption });

                  setOpen(false);
                }}
                className="max-w-md"
              >
                {render({
                  data: newOption,
                  onFieldChange: (value) => {
                    setNewOption({
                      ...newOption,
                      ...value,
                    });
                  },
                })}
                <div className="mt-5 flex flex-row-reverse gap-x-2 sm:mt-6">
                  <Button color="primary" type="submit">
                    Save Changes
                  </Button>
                  <Button
                    onClick={() => {
                      setOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Dialog.Panel>
          </PanelTransition>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

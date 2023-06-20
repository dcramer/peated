import { Dialog } from "@headlessui/react";
import { ClientOnly } from "./clientOnly";

export function ImageModal({
  image,
  open,
  setOpen,
}: {
  image: string;
  open: boolean;
  setOpen: (value: boolean) => void;
}) {
  return (
    <ClientOnly>
      {() => (
        <Dialog open={open} as="div" className="dialog" onClose={setOpen}>
          <Dialog.Overlay className="fixed inset-0" />
          <Dialog.Panel
            className="dialog-panel flex flex-col items-center justify-center px-4 pb-4 pt-5 sm:p-6"
            onClick={() => {
              setOpen(false);
            }}
          >
            <img src={image} className="max-h-full max-w-full" />
          </Dialog.Panel>
        </Dialog>
      )}
    </ClientOnly>
  );
}

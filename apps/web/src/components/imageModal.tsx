"use client";

import { Dialog, DialogPanel } from "@headlessui/react";

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
    <Dialog open={open} as="div" className="dialog" onClose={setOpen}>
      <div className="fixed inset-0">
        <DialogPanel
          className="dialog-panel flex flex-col items-center justify-center px-4 pb-4 pt-5 sm:p-6"
          onClick={() => {
            setOpen(false);
          }}
        >
          <img src={image} className="max-h-full max-w-full" />
        </DialogPanel>
      </div>
    </Dialog>
  );
}

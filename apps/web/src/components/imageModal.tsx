import { Dialog } from "@headlessui/react";

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
      <Dialog.Overlay className="fixed inset-0" />
      <Dialog.Panel className="dialog-panel flex flex-col items-center justify-center px-4 pb-4 pt-5 sm:p-6">
        <img
          src={image}
          className="max-h-full max-w-full"
          onClick={() => setOpen(false)}
        />
      </Dialog.Panel>
    </Dialog>
  );
}

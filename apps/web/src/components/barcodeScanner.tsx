import { Dialog } from "@headlessui/react";
import { useZxing } from "react-zxing";
import { useMediaDevices } from "../hooks/useMediaDevices";

export type Props = {
  open: boolean;
  setOpen: (value: boolean) => void;
  onResult: any;
  onError: any;
};

export default ({ open, setOpen, onResult, onError }: Props) => {
  const { ref } = useZxing({
    onResult,
    onError,
  });

  return (
    <Dialog
      as="div"
      className="fixed inset-0 z-10 overflow-y-auto min-h-screen"
      unmount={true}
      open={open}
      onClose={setOpen}
    >
      <Dialog.Overlay className="fixed inset-0" />
      <Dialog.Panel className="relative h-screen transform overflow-hidden bg-white px-4 pb-4 pt-5 text-left transition-all min-w-full sm:p-6 justify-center items-center flex">
        <video ref={ref} />
      </Dialog.Panel>
    </Dialog>
  );
};

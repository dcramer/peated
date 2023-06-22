import { Dialog } from "@headlessui/react";
import Button from "./button";

type Props = {
  isOpen: boolean;
  onContinue: () => void;
  onCancel: () => void;
};

export default function ConfirmationDialog({
  isOpen,
  onContinue,
  onCancel,
}: Props) {
  return (
    <Dialog as="div" open={isOpen} className="dialog" onClose={onCancel}>
      <Dialog.Overlay className="fixed inset-0" />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="dialog-panel flex min-h-full items-center justify-center p-4 text-center">
          <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded bg-slate-900 p-6 text-left align-middle shadow-xl transition-all">
            <Dialog.Title
              as="h3"
              className="text-highlight text-lg font-medium leading-6"
            >
              Warning
            </Dialog.Title>
            <div className="mt-2">
              <p className="text-sm text-white">
                Are you sure you want to continue with this action?.
              </p>
            </div>

            <div className="mt-4 flex space-x-2">
              <Button
                color="default"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onContinue();
                }}
              >
                Continue
              </Button>
            </div>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
}

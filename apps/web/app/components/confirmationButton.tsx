import type { PropsWithChildren } from "react";
import { forwardRef, useState } from "react";
import { ClientOnly } from "./clientOnly";
import ConfirmationDialog from "./confirmationDialog.client";

export default forwardRef<
  HTMLButtonElement,
  PropsWithChildren<{
    onContinue: () => void;
    className?: string;
    style?: any;
  }>
>(({ onContinue, children, ...props }, ref) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <button {...props} ref={ref} onClick={() => setIsOpen(true)}>
      {children}
      <ClientOnly>
        {() => (
          <ConfirmationDialog
            isOpen={isOpen}
            onContinue={() => {
              setIsOpen(false);
              onContinue();
            }}
            onCancel={() => {
              setIsOpen(false);
            }}
          />
        )}
      </ClientOnly>
    </button>
  );
});

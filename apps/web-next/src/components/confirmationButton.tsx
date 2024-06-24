"use client";

import type { PropsWithChildren } from "react";
import { forwardRef, useState } from "react";
import ConfirmationDialog from "./confirmationDialog.client";

export default forwardRef<
  HTMLButtonElement,
  PropsWithChildren<{
    onContinue: () => void;
    className?: string;
    style?: any;
  }>
>(function ConfirmationButton({ onContinue, children, ...props }, ref) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <button {...props} ref={ref} onClick={() => setIsOpen(true)}>
      {children}
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
    </button>
  );
});

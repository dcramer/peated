"use client";

import type { PropsWithChildren } from "react";
import { forwardRef, useState } from "react";
import ConfirmationDialog from "./confirmationDialog.client";

export default forwardRef<
  HTMLButtonElement,
  PropsWithChildren<{
    onContinue: () => void;
    className?: string;
    disabled?: boolean;
    style?: any;
  }>
>(function ConfirmationButton(
  { onContinue, children, disabled, ...props },
  ref,
) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <button
      {...props}
      disabled={disabled}
      ref={ref}
      onClick={() => {
        if (!disabled) {
          setIsOpen(true);
        }
      }}
    >
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

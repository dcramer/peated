"use client";

import type { PropsWithChildren, ReactNode } from "react";
import { forwardRef, useState } from "react";
import ConfirmationDialog from "./confirmationDialog.client";

export default forwardRef<
  HTMLButtonElement,
  PropsWithChildren<{
    onContinue: () => void;
    className?: string;
    disabled?: boolean;
    style?: any;
    confirmationTitle?: string;
    confirmationMessage?: ReactNode;
    continueLabel?: string;
  }>
>(function ConfirmationButton(
  {
    onContinue,
    children,
    disabled,
    confirmationTitle,
    confirmationMessage,
    continueLabel,
    ...props
  },
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
        title={confirmationTitle}
        message={confirmationMessage}
        continueLabel={continueLabel}
      />
    </button>
  );
});

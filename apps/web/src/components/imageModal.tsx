"use client";

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import type { ReactNode } from "react";
import Button from "./button";

/**
 * Shared full-screen image viewer with an optional single contextual action.
 */
export function ImageModal({
  action,
  alt = "",
  image,
  open,
  setOpen,
  title,
}: {
  action?: {
    disabled?: boolean;
    icon?: ReactNode;
    label: string;
    onClick: () => void;
  };
  alt?: string;
  image: string;
  open: boolean;
  setOpen: (value: boolean) => void;
  title?: string;
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
          {title && <DialogTitle className="sr-only">{title}</DialogTitle>}
          <img src={image} alt={alt} className="max-h-full max-w-full" />
          {action && (
            <div
              className="absolute bottom-4 left-1/2 flex -translate-x-1/2 justify-center sm:bottom-6"
              onClick={(event) => event.stopPropagation()}
            >
              <Button
                size="small"
                icon={action.icon}
                disabled={action.disabled}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

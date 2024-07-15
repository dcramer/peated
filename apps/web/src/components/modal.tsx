"use client";

import { Dialog, DialogPanel } from "@headlessui/react";
import { type ComponentPropsWithoutRef } from "react";

export function Modal({
  children,
  ...props
}: { children: React.ReactNode } & ComponentPropsWithoutRef<typeof Dialog>) {
  return (
    <div>
      <Dialog as="div" className="dialog" {...props}>
        <div className="fixed inset-0">
          <DialogPanel className="dialog-panel">{children}</DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}

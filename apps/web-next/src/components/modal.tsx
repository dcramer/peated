"use client";

import { Dialog } from "@headlessui/react";
import { useRouter } from "next/navigation";

export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div>
      <Dialog as="div" open className="dialog" onClose={router.back}>
        <Dialog.Overlay className="fixed inset-0" />

        <Dialog.Panel className="dialog-panel">{children}</Dialog.Panel>
      </Dialog>
    </div>
  );
}

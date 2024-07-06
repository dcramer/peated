"use client";

import { Dialog, DialogPanel } from "@headlessui/react";
import { useRouter } from "next/navigation";

export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div>
      <Dialog as="div" open className="dialog" onClose={router.back}>
        <div className="fixed inset-0">
          <DialogPanel className="dialog-panel">{children}</DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}

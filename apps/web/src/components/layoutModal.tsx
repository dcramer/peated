import { type ReactNode } from "react";
import AppHeader from "./appHeader";
import ModalHeader from "./modalHeader";

export default function LayoutModal({
  children,
  header,
}: {
  children: ReactNode;
  header?: ReactNode;
}) {
  return (
    <div className="relative mx-auto max-w-7xl">
      <div className="max-w-7xl">
        <ModalHeader>
          {header !== undefined ? header : <AppHeader />}
        </ModalHeader>

        <main className="w-full max-w-7xl flex-auto">
          <div className="mx-auto lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

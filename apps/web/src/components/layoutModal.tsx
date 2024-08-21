import { type ReactNode } from "react";
import classNames from "../lib/classNames";
import AppHeader from "./appHeader";
import ModalHeader from "./modalHeader";

export default function LayoutModal({
  children,
  header,
  noMargin = false,
}: {
  children: ReactNode;
  header?: ReactNode;
  noMargin?: boolean;
}) {
  return (
    <div className="relative mx-auto max-w-7xl">
      <div className="max-w-7xl">
        <ModalHeader>
          {header !== undefined ? header : <AppHeader />}
        </ModalHeader>

        <main className="w-full max-w-7xl flex-auto">
          <div className={classNames("mx-auto", noMargin ? "" : "py-4 lg:p-8")}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

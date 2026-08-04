import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import { createContext, useContext, type ReactNode } from "react";
import Header from "./header";

const SidePanelContext = createContext<{
  onClose?: (() => void) | undefined | null;
}>({
  onClose: null,
});

export function SidePanelHeader({
  children,
  title,
}: {
  children?: ReactNode;
  title: string;
}) {
  const { onClose } = useContext(SidePanelContext);
  const blockStyles = `px-0 py-1 sm:py-3`;

  return (
    <>
      <DialogTitle className="sr-only">{title}</DialogTitle>
      <Header mobileOnly semantic={false}>
        <nav className="flex min-w-full items-center justify-between text-white lg:hidden">
          {!!onClose && (
            <div className="absolute left-2 flex text-white hover:text-white">
              <button
                aria-label="Close panel"
                onClick={onClose ?? undefined}
                className={`-m-1.5 p-1.5 ${blockStyles} pr-3 sm:pr-6`}
              >
                <div className="h-10 w-10">
                  <ChevronLeftIcon className="h-10 w-10" />
                </div>
              </button>
            </div>
          )}
          <div
            className={`flex flex-auto flex-row justify-center gap-x-2 ${blockStyles}`}
          >
            <span className="text-lg">{title}</span>
          </div>
        </nav>
      </Header>
      <div className="hidden items-center space-x-4 border-b border-b-slate-800 text-white lg:mb-4 lg:flex lg:flex-row lg:pb-4">
        {children ?? (
          <span className="flex-1 py-4 text-lg font-semibold">{title}</span>
        )}
        {!!onClose && (
          <button
            aria-label="Close panel"
            className="hover:bg-highlight hidden cursor-pointer items-center justify-center rounded px-6 py-6 font-mono text-2xl hover:text-black lg:flex"
            onClick={onClose ?? undefined}
          >
            <span aria-hidden="true">✕</span>
          </button>
        )}
      </div>
    </>
  );
}

export default function SidePanel({
  onClose,
  open,
  children,
  ...props
}: {
  children: ReactNode;
  open: boolean;
  onClose?: () => void;
}) {
  const context = {
    onClose,
  };

  return (
    <div>
      <Dialog
        open={open}
        onClose={() => {
          onClose && onClose();
        }}
        className="fixed inset-0 z-50 h-dvh overflow-auto border-l border-l-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 to-20% lg:left-1/3 lg:px-6 lg:py-4"
        {...props}
      >
        <SidePanelContext.Provider value={context}>
          <DialogPanel>{children}</DialogPanel>
        </SidePanelContext.Provider>
      </Dialog>
    </div>
  );
}

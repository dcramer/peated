import { Dialog } from "@headlessui/react";
import { createContext, useContext, type ReactNode } from "react";

const SidePanelContext = createContext<{
  onClose?: (() => void) | undefined | null;
}>({
  onClose: null,
});

export function SidePanelHeader({ children }: { children: ReactNode }) {
  const { onClose } = useContext(SidePanelContext);

  return (
    <div className="mb-4 flex items-center space-x-4 border-b border-b-slate-800 pb-4 text-white">
      {children}
      <button
        className="hover:bg-highlight flex cursor-pointer items-center justify-center rounded px-6 py-6 font-mono text-2xl hover:text-black"
        onClick={onClose ?? undefined}
      >
        {"✕"}
      </button>
    </div>
  );
}

export default function SidePanel({
  onClose,
  open = false,
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
    <Dialog
      open={open}
      onClose={() => {
        onClose && onClose();
      }}
      className="absolute bottom-0 left-0 right-0 top-0 z-20 h-full overflow-auto border-l border-l-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 to-20% px-6 py-4 lg:fixed lg:left-1/3"
      {...props}
    >
      <SidePanelContext.Provider value={context}>
        <Dialog.Panel>{children}</Dialog.Panel>
      </SidePanelContext.Provider>
    </Dialog>
  );
}

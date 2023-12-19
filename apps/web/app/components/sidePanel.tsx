import {
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";

export function SidePanelHeader({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="mb-4 flex items-center space-x-4 border-b border-b-slate-800 pb-4 text-white">
      {children}
      <button
        className="hover:bg-highlight flex cursor-pointer items-center justify-center rounded px-6 py-6 font-mono text-2xl hover:text-black"
        onClick={onClose}
      >
        {"✕"}
      </button>
    </div>
  );
}

export default function SidePanel({
  onClose,
  ...props
}: Omit<ComponentPropsWithoutRef<"div">, "className"> & {
  onClose?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const clickHandler = function (e: MouseEvent) {
      if (!onClose) return;
      if (!ref.current) return;
      if (!ref.current.contains(e.target as any)) {
        // TODO: not handling correctling yet - fires on open vs only after open
        // onClose();
      }
    };
    window.addEventListener("click", clickHandler);
    return () => {
      window.removeEventListener("click", clickHandler);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-0 left-0 right-0 top-0 z-20 h-full overflow-auto border-l border-l-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 to-20% px-6 py-4 lg:fixed lg:left-1/3"
      {...props}
    />
  );
}

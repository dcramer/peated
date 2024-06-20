import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

export default function SearchHeader({
  name,
  onClose,
  onChange,
  onSubmit,
  onDone,
  placeholder,
  closeIcon = <ChevronLeftIcon className="h-8 w-8" />,
  ...props
}: {
  value?: string;
  name?: string;
  placeholder?: string;
  closeIcon?: ReactNode;
  onClose?: () => void;
  onDone?: () => void;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(props.value || "");

  const blockStyles = `p-3`;

  // we store the onChange event here as setState is async
  // and if you type a value and quickly hit enter (to submit)
  // it will not capture the last character
  let _lastValue = value;

  return (
    <nav className="flex min-w-full items-stretch justify-between text-white lg:mx-3 lg:gap-x-3">
      <div className="-mx-3 flex items-center">
        <button
          onClick={() => (onClose ? onClose() : router.back())}
          className={`${blockStyles} text-light group flex justify-center`}
        >
          <div className="-my-1 rounded bg-slate-800 p-1 group-hover:bg-slate-700 group-hover:text-white">
            {closeIcon}
          </div>
        </button>
      </div>
      <form
        className={`flex flex-auto flex-col items-stretch justify-center pl-3 pr-2 lg:pr-7`}
        onSubmit={(e) => {
          e.preventDefault();

          if (onSubmit) onSubmit(_lastValue);
          else if (onChange) onChange(_lastValue);
        }}
      >
        <input
          autoFocus
          name={name}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            _lastValue = e.target.value;
            setValue(e.target.value);
            if (onChange) onChange(e.target.value);
          }}
          className="block transform rounded border-transparent bg-slate-800 px-2 py-1.5 text-white placeholder:text-slate-400 focus:border-transparent focus:outline focus:outline-slate-700 focus:ring-0 sm:px-3 sm:py-1.5"
        />
      </form>
      {onDone && (
        <div className="flex">
          <button
            onClick={onDone}
            className={`group min-h-full ${blockStyles}`}
          >
            <span className="text-light rounded bg-slate-800 p-2.5 font-semibold group-hover:bg-slate-700 group-hover:text-white">
              Done
            </span>
          </button>
        </div>
      )}
    </nav>
  );
}

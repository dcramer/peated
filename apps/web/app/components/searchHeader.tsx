import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import { useNavigate } from "@remix-run/react";
import type { ReactNode } from "react";
import { useState } from "react";
import classNames from "../lib/classNames";

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
  const navigate = useNavigate();
  const [value, setValue] = useState(props.value || "");

  const blockStyles = `p-3`;

  // we store the onChange event here as setState is async
  // and if you type a value and quickly hit enter (to submit)
  // it will not capture the last character
  let _lastValue = value;

  return (
    <nav className="flex min-w-full items-stretch justify-between text-white lg:mx-3">
      <div className="text-light flex items-stretch hover:text-white lg:hover:bg-slate-700">
        <button
          onClick={() => (onClose ? onClose() : navigate(-1))}
          className={`${blockStyles} flex items-center justify-center`}
        >
          <span className="sr-only">Back</span>
          <span className="h-8 w-8">{closeIcon}</span>
        </button>
      </div>
      <form
        className={classNames(
          blockStyles,
          `flex flex-auto flex-row items-center justify-center`,
        )}
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
          className="w-full transform rounded border-transparent bg-slate-800 px-2 py-1.5 text-white placeholder:text-slate-400 focus:border-transparent focus:outline focus:outline-slate-700 focus:ring-0 sm:px-3 sm:py-2"
        />
      </form>
      {onDone && (
        <div className="flex">
          <button
            onClick={onDone}
            className={`group min-h-full ${blockStyles}`}
          >
            <span className="bg-peated-dark group-hover:bg-peated-dark focus-visible:outline-peated rounded p-2.5 font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              Done
            </span>
          </button>
        </div>
      )}
    </nav>
  );
}

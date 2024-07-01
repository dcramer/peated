"use client";

import { useEffect, useState, type ReactNode } from "react";

export default function SearchHeaderForm({
  name = "q",
  placeholder,
  onChange,
  onSubmit,
  onFocus,
  children,
  ...props
}: {
  value?: string;
  name?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onFocus?: () => void;
  children?: ReactNode;
}) {
  const [value, setValue] = useState(props.value ?? "");

  useEffect(() => {
    const newValue = props.value ?? "";
    setValue(newValue);
    if (onChange) onChange(newValue);
  }, [props.value]);

  // we store the onChange event here as setState is async
  // and if you type a value and quickly hit enter (to submit)
  // it will not capture the last character
  let _lastValue = value;

  return (
    <form
      className={`flex flex-auto flex-col items-stretch justify-center pl-3 pr-2 lg:pr-7`}
      action="/search"
      method="get"
      onSubmit={(e) => {
        e.stopPropagation();

        if (onSubmit) onSubmit(_lastValue);
        else if (onChange) onChange(_lastValue);
      }}
    >
      <input
        autoFocus
        name={name}
        value={value}
        placeholder={placeholder}
        onFocus={onFocus}
        onChange={(e) => {
          _lastValue = e.target.value;
          setValue(e.target.value);
          if (onChange) onChange(e.target.value);
        }}
        className="block transform rounded border-transparent bg-slate-800 px-2 py-1.5 text-white placeholder:text-slate-400 focus:border-transparent focus:outline focus:outline-slate-700 focus:ring-0 sm:px-3 sm:py-1.5"
      />
      {children}
    </form>
  );
}

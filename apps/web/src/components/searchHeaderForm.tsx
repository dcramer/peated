"use client";

import { useEffect, useState, type ReactNode } from "react";
import useAutofocus from "../hooks/useAutofocus";
import Spinner from "./spinner";

export default function SearchHeaderForm({
  name = "q",
  placeholder,
  onChange,
  onSubmit,
  onFocus,
  autoFocus,
  children,
  loading,
  ...props
}: {
  value?: string;
  name?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onFocus?: () => void;
  autoFocus?: boolean;
  loading?: boolean;
  children?: ReactNode;
}) {
  const [value, setValue] = useState(props.value ?? "");

  const ref = useAutofocus<HTMLInputElement>(() => {
    return autoFocus || !onFocus;
  });

  useEffect(() => {
    if (props.value !== value) {
      const newValue = props.value ?? "";
      setValue(newValue);
      if (onChange) onChange(newValue);
    }
  }, [props.value]);

  // we store the onChange event here as setState is async
  // and if you type a value and quickly hit enter (to submit)
  // it will not capture the last character
  let _lastValue = value;

  return (
    <form
      className="relative flex flex-auto flex-col items-stretch justify-center"
      action="/search"
      method="get"
      onSubmit={(e) => {
        e.stopPropagation();

        if (onSubmit) onSubmit(_lastValue);
        else if (onChange) onChange(_lastValue);
      }}
    >
      <input
        autoFocus={autoFocus || !onFocus}
        name={name}
        value={value}
        placeholder={placeholder}
        onFocus={onFocus}
        onChange={(e) => {
          _lastValue = e.target.value;
          setValue(e.target.value);
          if (onChange) onChange(e.target.value);
        }}
        className="block transform rounded border-slate-800 bg-slate-800 px-2 py-1 text-white outline outline-slate-800 placeholder:text-slate-400 focus:border-slate-800 focus:outline-slate-700 focus:ring-0 sm:px-3"
        ref={ref}
      />
      {loading && (
        <div className="absolute bottom-0 right-0 top-0 z-10 p-1">
          <Spinner
            className="m-0 h-7 w-7 text-white"
            pathClassName="stroke-white"
          />
        </div>
      )}
      {children}
    </form>
  );
}

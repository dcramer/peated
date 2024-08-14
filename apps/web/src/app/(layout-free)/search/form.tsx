"use client";

import Spinner from "@peated/web/components/spinner";
import useAutofocus from "@peated/web/hooks/useAutofocus";
import { useRef, type ReactNode } from "react";
import { useDebounceCallback } from "usehooks-ts";

export default function SearchHeaderForm({
  name = "q",
  placeholder,
  autoFocus,
  children,
  loading,
  value,
}: {
  value?: string;
  name?: string;
  placeholder?: string;
  autoFocus?: boolean;
  loading?: boolean;
  children?: ReactNode;
}) {
  const inputRef = useAutofocus<HTMLInputElement>(() => {
    return !!autoFocus;
  });

  const formRef = useRef<HTMLFormElement | null>(null);

  const handleInputChange = useDebounceCallback((e) => {
    e.preventDefault();
    formRef.current?.requestSubmit();
  }, 200);

  return (
    <form
      className="relative flex flex-auto flex-col items-stretch justify-center"
      action="/search"
      ref={formRef}
    >
      <input
        autoFocus={autoFocus}
        name={name}
        placeholder={placeholder}
        defaultValue={value}
        onChange={handleInputChange}
        className="block transform rounded border-slate-800 bg-slate-800 px-2 py-1 text-white outline outline-slate-800 placeholder:text-slate-400 focus:border-slate-800 focus:outline-slate-700 focus:ring-0 sm:px-3"
        ref={inputRef}
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

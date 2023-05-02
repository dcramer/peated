import { useNavigate } from "react-router-dom";
import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import TextInput from "./textInput";
import { useState } from "react";

export default function SearchHeader({
  name,
  onChange,
  onSubmit,
  ...props
}: {
  value?: string;
  name?: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
}) {
  const navigate = useNavigate();
  const [value, setValue] = useState(props.value || "");

  const blockStyles = `px-0 sm:px-6 py-1 sm:py-3`;

  return (
    <nav className="flex min-w-full items-center justify-between text-white">
      <div className="flex text-white hover:text-white">
        <button
          onClick={() => navigate(-1)}
          className={`-m-1.5 p-1.5 ${blockStyles} pr-3`}
        >
          <span className="sr-only">Back</span>
          <ChevronLeftIcon className="h-8 w-8" />
        </button>
      </div>
      <form
        className={`flex-1 px-0 sm:px-6`}
        onSubmit={(e) => {
          e.preventDefault();

          (onSubmit || onChange)(value);
        }}
      >
        <TextInput
          name={name}
          defaultValue={value}
          placeholder="Search for a bottle"
          onChange={(e) => {
            setValue(e.target.value);
            onChange(e.target.value);
          }}
          noGutter
          className="min-w-full px-2 sm:px-3 py-1 sm:py-3 bg-peated-darker text-white"
        />
      </form>
    </nav>
  );
}

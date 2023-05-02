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

  return (
    <nav className="flex min-w-full items-center py-3 justify-between text-white">
      <div className="flex text-white hover:text-white px-6">
        <button onClick={() => navigate(-1)} className="-m-1.5 p-1.5">
          <span className="sr-only">Back</span>
          <ChevronLeftIcon className="h-8 w-auto" />
        </button>
      </div>
      <form
        className="flex-1 px-6"
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
        />
      </form>
    </nav>
  );
}

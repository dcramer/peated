import { useNavigate } from "react-router-dom";
import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import { ReactNode, useState } from "react";

export default function SearchHeader({
  name,
  onClose,
  onChange,
  onSubmit,
  placeholder,
  closeIcon = <ChevronLeftIcon className="h-8 w-8" />,
  ...props
}: {
  value?: string;
  name?: string;
  placeholder?: string;
  closeIcon?: ReactNode;
  onClose?: () => void;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
}) {
  const navigate = useNavigate();
  const [value, setValue] = useState(props.value || "");

  const blockStyles = `px-0 py-1 sm:py-3`;

  return (
    <nav className="flex min-w-full items-center justify-between text-white">
      <div className="flex text-white hover:text-white">
        <button
          onClick={() => (onClose ? onClose() : navigate(-1))}
          className={`-m-1.5 p-1.5 ${blockStyles} pr-3 sm:pr-6 outline-0`}
        >
          <span className="sr-only">Back</span>
          <span className="h-10 w-10">{closeIcon}</span>
        </button>
      </div>
      <form
        className={`flex-1`}
        onSubmit={(e) => {
          e.preventDefault();

          if (onSubmit) onSubmit(value);
          else if (onChange) onChange(value);
        }}
      >
        <input
          autoFocus
          name={name}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            setValue(e.target.value);
            if (onChange) onChange(e.target.value);
          }}
          className="rounded focus:outline focus:outline-peated-light min-w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-peated-darker text-white"
        />
      </form>
    </nav>
  );
}

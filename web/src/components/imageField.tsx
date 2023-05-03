import { ReactNode, useRef, useState } from "react";

import FormField from "./formField";
import TextInput from "./textInput";
import Button from "./button";
import HelpText from "./helpText";

type Props = React.ComponentProps<typeof TextInput> & {
  label?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
  buttonLabel?: string;
  className?: string;
  value?: string;
};

export default ({
  name,
  helpText,
  label,
  required,
  buttonLabel,
  className,
  value,
  ...props
}: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isHover, setHover] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(value || null);

  const updatePreview = () => {
    const file = Array.from(fileRef.current!.files).find(() => true);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageSrc(e.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      imageRef.current!.src = "";
    }
  };

  return (
    <FormField
      label={label}
      htmlFor={`f-${name}`}
      required={required}
      helpText={helpText}
      className={className}
      // dragover and dragenter events need to have 'preventDefault' called
      // in order for the 'drop' event to register.
      // See: https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Drag_operations#droptargets
      // https://stackoverflow.com/questions/8006715/drag-drop-files-into-standard-html-file-input
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragExit={(e) => {
        e.preventDefault();
        setHover(false);
      }}
      onMouseOver={(e) => {
        setHover(true);
      }}
      onMouseOut={(e) => {
        setHover(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const dt = new DataTransfer();
        Array.from(e.dataTransfer.files).forEach((f) => dt.items.add(f));
        fileRef.current!.files = dt.files;
        updatePreview();
      }}
    >
      <div className="col-span-full flex items-center gap-x-4 min-w-full">
        <div
          className="h-24 w-24 flex-none rounded bg-gray-100 object-cover"
          onClick={(e) => {
            e.preventDefault();
            fileRef.current?.click();
          }}
        >
          {imageSrc && (
            <img
              src={imageSrc}
              ref={imageRef}
              className="h-full w-full rounded object-cover"
            />
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          name={name}
          accept="image/*"
          required={required}
          className="hidden"
          onChange={(e) => {
            e.preventDefault();
            updatePreview();
          }}
        />
        <div>
          <Button
            type="button"
            color="primary"
            onClick={(e) => {
              e.preventDefault();
              fileRef.current?.click();
            }}
          >
            Upload Image
          </Button>
          <HelpText>JPG, GIF or PNG. 1MB max.</HelpText>
        </div>
      </div>
    </FormField>
  );
};

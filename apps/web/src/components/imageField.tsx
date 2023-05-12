import { ReactNode, useEffect, useRef, useState } from "react";

import Button from "./button";
import FormField from "./formField";
import HelpText from "./helpText";
import TextInput from "./textInput";

type Props = Omit<React.ComponentProps<typeof TextInput>, "value"> & {
  label?: string;
  buttonLabel?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
  className?: string;
  value?: string | File | undefined;
};

const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result !== "data:") {
        resolve(reader.result as string);
      } else {
        resolve("");
      }
    };
    reader.onerror = () => {
      reject(reader.error);
    };
    reader.readAsDataURL(file);
  });
};

export default ({
  name,
  label,
  buttonLabel = "Upload Image",
  helpText,
  required,
  className,
  value,
  onChange,
}: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [_isHover, setHover] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>();

  useEffect(() => {
    (async () => {
      if (value instanceof File) {
        setImageSrc(await fileToDataUrl(value));
      } else {
        setImageSrc(value || "");
      }
    })();
  }, [value]);

  const updatePreview = () => {
    const file = Array.from(fileRef.current?.files || []).find(() => true);
    if (file) {
      (async () => {
        setImageSrc(await fileToDataUrl(file));
      })();
    } else {
      if (imageRef.current) imageRef.current.src = "";
      setImageSrc("");
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
      onClick={(e) => {
        fileRef.current?.click();
      }}
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
      onMouseOver={() => {
        setHover(true);
      }}
      onMouseOut={() => {
        setHover(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const dt = new DataTransfer();
        Array.from(e.dataTransfer.files).forEach((f) => dt.items.add(f));
        if (fileRef.current) fileRef.current.files = dt.files;
        updatePreview();
      }}
    >
      <div className="col-span-full mt-2 flex min-w-full items-center gap-x-4">
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
            e.stopPropagation();
            updatePreview();
            if (onChange) onChange(e);
          }}
        />
        <div>
          <Button
            type="button"
            color="primary"
            onClick={(e) => {
              e.stopPropagation();
              fileRef.current?.click();
            }}
          >
            {buttonLabel}
          </Button>
          <HelpText>JPG, GIF or PNG. 1MB max.</HelpText>
        </div>
      </div>
    </FormField>
  );
};

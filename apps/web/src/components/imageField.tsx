"use client";

import type { ReactNode } from "react";
import { forwardRef, useEffect, useRef, useState } from "react";

import { PhotoIcon } from "@heroicons/react/20/solid";
import { rejects } from "assert";
import setRef from "../lib/setRef";
import Button from "./button";
import FormField from "./formField";
import ImageEditorModal from "./imageEditorModal";
import type TextInput from "./textInput";

type Props = Omit<
  React.ComponentProps<typeof TextInput>,
  "value" | "onChange"
> & {
  label?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
  className?: string;
  value?: string | null | undefined;
  error?: {
    message?: string;
  };
  onChange: (value: HTMLCanvasElement | null) => void;
  imageWidth?: number;
  imageHeight?: number;
  noEditor?: boolean;
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

function fileDataToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = function (e) {
      if (!e.target?.result) return reject(new Error("Unable to read file"));
      const image = new Image();
      image.src = e.target.result as any;
      image.onload = function (ev) {
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Unable to get 2d context"));
        ctx.drawImage(image, 0, 0);
        resolve(canvas);
      };
    };
  });
}

export default forwardRef<HTMLInputElement, Props>(
  (
    {
      name,
      label,
      helpText,
      required,
      className,
      value,
      error,
      onChange,
      imageWidth = 600,
      imageHeight = 600,
      noEditor,
    },
    ref,
  ) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const [_isHover, setHover] = useState(false);
    const [imageSrc, setImageSrc] = useState<string | null>();
    const [finalImage, setFinalImage] = useState<HTMLCanvasElement | null>();

    const [editorOpen, setEditorOpen] = useState(false);

    useEffect(() => {
      setImageSrc(value || "");
      setFinalImage(null);
    }, [value]);

    const updateImageSrc = () => {
      const file = Array.from(fileRef.current?.files || []).find(() => true);
      if (file) {
        (async () => {
          const imageSrc = await fileToDataUrl(file);
          setImageSrc(imageSrc);
          if (noEditor) onSave(await fileDataToCanvas(file));
          else setEditorOpen(true);
        })();
      } else {
        if (imageRef.current) imageRef.current.src = "";
        setImageSrc("");
        onSave(null);
      }
    };

    const onSave = (image: HTMLCanvasElement | null) => {
      setFinalImage(image);
      if (onChange) onChange(image);
    };

    return (
      <FormField
        label={label}
        htmlFor={`f-${name}`}
        required={required}
        helpText={helpText}
        className={className}
        error={error}
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
          updateImageSrc();
        }}
      >
        <div className="col-span-full mt-2 flex min-w-full items-center gap-x-4 border border-slate-800">
          <div className="group flex min-w-full flex-col items-center gap-4 overflow-hidden rounded bg-slate-800 object-contain p-3">
            {imageSrc || finalImage ? (
              <img
                src={
                  (finalImage ? finalImage.toDataURL() : imageSrc) || undefined
                }
                ref={imageRef}
                alt="uploaded image"
                className="rounded object-contain"
                style={{
                  maxHeight: imageHeight,
                }}
              />
            ) : (
              <div className="flex w-full flex-col items-center justify-center p-4 text-sm group-hover:bg-slate-700">
                <PhotoIcon className="h-12 w-12" />
                Tap to upload an Image
              </div>
            )}
            {(imageSrc || finalImage) && (
              <div
                className={`text-muted flex items-center justify-center gap-x-4`}
                style={{
                  maxHeight: imageHeight,
                }}
              >
                <Button color="highlight">Change Image</Button>
                <Button
                  color="danger"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (fileRef.current) fileRef.current.value = "";
                    setImageSrc("");
                    setFinalImage(null);
                    onChange(null);
                  }}
                >
                  Remove Image
                </Button>
              </div>
            )}
          </div>
          <input
            type="file"
            name={name}
            accept="image/*"
            required={required}
            className="hidden"
            ref={(node) => {
              setRef(fileRef, node);
            }}
            onClick={(e: any) => {
              // this forces onChange to fire
              e.target.value = null;
            }}
            onChange={(e) => {
              e.stopPropagation();
              updateImageSrc();
            }}
          />
          {/* <div>
            <Button
              type="button"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                fileRef.current?.click();
              }}
            >
              Select Image
            </Button>
            <HelpText>JPG, GIF or PNG. 1MB max.</HelpText>
          </div> */}
        </div>
        {!noEditor && (
          <ImageEditorModal
            image={imageSrc}
            open={editorOpen}
            setOpen={setEditorOpen}
            onSave={onSave}
            width={imageWidth}
            height={imageHeight}
          />
        )}
      </FormField>
    );
  },
);

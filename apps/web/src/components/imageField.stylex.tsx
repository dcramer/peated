"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import * as stylex from "@stylexjs/stylex";
import { ImagePlus, RotateCw } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import AvatarEditor from "react-avatar-editor";
import { z } from "zod";

import { Button, Field } from ".";
import setRef from "../lib/setRef";
import { colors, effects, fonts, space } from "../styles/tokens.stylex";

type Props = {
  error?: { message?: string };
  helpText?: string;
  imageHeight?: number;
  imageWidth?: number;
  initialFile?: File | null;
  label?: string;
  name?: string;
  noEditor?: boolean;
  onChange: (value: HTMLCanvasElement | null) => void;
  required?: boolean;
  value?: string | null;
};

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = z.string().safeParse(reader.result);
      resolve(result.success && result.data !== "data:" ? result.data : "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const source = await fileToDataUrl(file);
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Unable to read the image."));
      context.drawImage(image, 0, 0);
      resolve(canvas);
    };
    image.onerror = () => reject(new Error("Unable to read the image."));
    image.src = source;
  });
}

const ImageField = forwardRef<HTMLInputElement, Props>(function ImageField(
  {
    error,
    helpText,
    imageHeight = 600,
    imageWidth = 600,
    initialFile,
    label = "Image",
    name = "image",
    noEditor = false,
    onChange,
    required,
    value,
  },
  forwardedRef,
) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [imageSource, setImageSource] = useState(value ?? "");
  const [finalImage, setFinalImage] = useState<HTMLCanvasElement | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const save = useCallback((image: HTMLCanvasElement | null) => {
    setFinalImage(image);
    onChangeRef.current(image);
  }, []);
  useEffect(() => {
    setImageSource(value ?? "");
    setFinalImage(null);
  }, [value]);
  useEffect(() => {
    if (!initialFile) return;
    void (async () => {
      setImageSource(await fileToDataUrl(initialFile));
      save(await fileToCanvas(initialFile));
    })();
  }, [initialFile, save]);

  async function readSelection() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setImageSource("");
      save(null);
      return;
    }
    setImageSource(await fileToDataUrl(file));
    if (noEditor) save(await fileToCanvas(file));
    else setEditorOpen(true);
  }

  const preview = finalImage?.toDataURL() || imageSource || undefined;
  return (
    <Field
      error={error?.message}
      hint={helpText}
      htmlFor={`f-${name}`}
      label={label}
      optional={!required}
      required={required}
    >
      <div
        {...stylex.props(styles.frame, Boolean(preview) && styles.previewFrame)}
      >
        {preview ? (
          <img
            alt="Image preview"
            src={preview}
            {...stylex.props(styles.preview)}
          />
        ) : (
          <ImagePlus
            aria-hidden="true"
            size={44}
            {...stylex.props(styles.placeholderIcon)}
          />
        )}
        <div {...stylex.props(styles.actions)}>
          <Button
            onClick={() => fileRef.current?.click()}
            size="sm"
            variant="tonal"
          >
            {preview ? "Change image" : "Choose image"}
          </Button>
          {preview ? (
            <Button
              onClick={() => {
                if (fileRef.current) fileRef.current.value = "";
                setImageSource("");
                save(null);
              }}
              size="sm"
              variant="danger"
            >
              Remove image
            </Button>
          ) : null}
        </div>
      </div>
      <input
        accept="image/*"
        id={`f-${name}`}
        name={name}
        onChange={() => void readSelection()}
        onClick={(event) => {
          event.currentTarget.value = "";
        }}
        ref={(node) => {
          setRef(fileRef, node);
          setRef(forwardedRef, node);
        }}
        required={required}
        type="file"
        {...stylex.props(styles.fileInput)}
      />
      {!noEditor ? (
        <ImageCropDialog
          height={imageHeight}
          image={imageSource}
          onClose={() => setEditorOpen(false)}
          onSave={(image) => {
            save(image);
            setEditorOpen(false);
          }}
          open={editorOpen}
          width={imageWidth}
        />
      ) : null}
    </Field>
  );
});

function ImageCropDialog({
  height,
  image,
  onClose,
  onSave,
  open,
  width,
}: {
  height: number;
  image: string;
  onClose: () => void;
  onSave: (image: HTMLCanvasElement) => void;
  open: boolean;
  width: number;
}) {
  const editorRef = useRef<ComponentRef<typeof AvatarEditor>>(null);
  const [rotate, setRotate] = useState(0);
  const [scale, setScale] = useState(1);
  const displayWidth = Math.min(width, 480);
  const displayHeight = Math.min(height, 480);
  return (
    <Dialog onClose={onClose} open={open} {...stylex.props(styles.dialog)}>
      <DialogBackdrop {...stylex.props(styles.backdrop)} />
      <div {...stylex.props(styles.position)}>
        <DialogPanel {...stylex.props(styles.panel)}>
          <DialogTitle {...stylex.props(styles.title)}>Crop image</DialogTitle>
          <div {...stylex.props(styles.editor)}>
            <AvatarEditor
              border={20}
              height={displayHeight}
              image={image}
              ref={editorRef}
              rotate={rotate}
              scale={scale}
              width={displayWidth}
            />
          </div>
          <label {...stylex.props(styles.rangeLabel)}>
            Zoom
            <input
              max={3}
              min={1}
              onChange={(event) => setScale(Number(event.currentTarget.value))}
              step={0.01}
              type="range"
              value={scale}
              {...stylex.props(styles.range)}
            />
          </label>
          <div {...stylex.props(styles.dialogActions)}>
            <Button
              onClick={() =>
                setRotate((value) => (value >= 270 ? 0 : value + 90))
              }
              size="sm"
              variant="tonal"
            >
              <RotateCw aria-hidden="true" size={16} /> Rotate
            </Button>
            <Button onClick={onClose} variant="tonal">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editorRef.current) onSave(editorRef.current.getImage());
              }}
            >
              Use image
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

const styles = stylex.create({
  frame: {
    display: "flex",
    minHeight: "150px",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: space.x4,
    padding: space.x4,
    borderWidth: "1px",
    borderStyle: "dashed",
    borderColor: colors.hairline,
    backgroundColor: colors.inset,
  },
  previewFrame: {
    borderStyle: "solid",
    backgroundColor: colors.imageBackground,
  },
  preview: {
    display: "block",
    maxWidth: "100%",
    maxHeight: "300px",
    objectFit: "contain",
  },
  placeholderIcon: { color: colors.inkMuted },
  actions: { display: "flex", gap: space.x2, flexWrap: "wrap" },
  fileInput: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
  },
  dialog: { position: "relative", zIndex: 80 },
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgb(0 0 0 / 0.72)",
  },
  position: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: space.x4,
    overflowY: "auto",
  },
  panel: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "620px",
    padding: space.x6,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    backgroundColor: colors.ground,
    boxShadow: effects.overlayShadow,
  },
  title: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "20px",
    fontWeight: 700,
  },
  editor: {
    display: "flex",
    justifyContent: "center",
    marginTop: space.x4,
    overflow: "auto",
  },
  rangeLabel: {
    display: "grid",
    gap: space.x2,
    marginTop: space.x4,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    textTransform: "uppercase",
  },
  range: { width: "100%", accentColor: colors.accent },
  dialogActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: space.x2,
    marginTop: space.x6,
    flexWrap: "wrap",
  },
});

export default ImageField;

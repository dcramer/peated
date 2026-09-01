"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { ImagePlus } from "lucide-react";
import { useRef } from "react";

import { Button, Field, FieldGroup, TextInput } from ".";
import { colors, space } from "../styles/tokens.stylex";
import { ImageViewer } from "./imageViewer.stylex";

type EntityImage = Outputs["entities"]["details"]["images"][number];

export type EntityImageDraft = {
  key: string;
  imageId: number | null;
  file: File | null;
  imageUrl: string;
  caption: string;
  sourceUrl: string;
  license: string;
  isPrimary: boolean;
};

export function entityImageDrafts(
  images: readonly EntityImage[] | undefined,
): EntityImageDraft[] {
  return (images ?? []).map((image) => ({
    key: `image-${image.id}`,
    imageId: image.id,
    file: null,
    imageUrl: image.imageUrl,
    caption: image.caption ?? "",
    sourceUrl: image.sourceUrl ?? "",
    license: image.license ?? "",
    isPrimary: image.isPrimary,
  }));
}

export function EntityImageEditor({
  disabled,
  images,
  onChange,
}: {
  disabled: boolean;
  images: EntityImageDraft[];
  onChange: (images: EntityImageDraft[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList) {
    const additions = Array.from(files).map((file) => ({
      key: `new-${crypto.randomUUID()}`,
      imageId: null,
      file,
      imageUrl: URL.createObjectURL(file),
      caption: "",
      sourceUrl: "",
      license: "",
      isPrimary: false,
    }));
    if (!images.length && additions[0]) additions[0].isPrimary = true;
    onChange([...images, ...additions]);
  }

  return (
    <FieldGroup label="Image files" optional>
      <div {...stylex.props(styles.root)}>
        {images.map((image) => (
          <div key={image.key} {...stylex.props(styles.row)}>
            <ImageViewer
              alt={image.caption || "Image preview"}
              label={image.caption || "image preview"}
              src={image.imageUrl}
            >
              <img
                alt={image.caption || "Image preview"}
                src={image.imageUrl}
                {...stylex.props(styles.preview)}
              />
            </ImageViewer>
            <div {...stylex.props(styles.fields)}>
              <Field
                htmlFor={`entity-image-caption-${image.key}`}
                label="Caption"
                optional
              >
                <TextInput
                  disabled={disabled}
                  id={`entity-image-caption-${image.key}`}
                  maxLength={500}
                  onChange={(event) => {
                    const caption = event.currentTarget.value;
                    onChange(
                      images.map((candidate) =>
                        candidate.key === image.key
                          ? { ...candidate, caption }
                          : candidate,
                      ),
                    );
                  }}
                  placeholder="What does this image show?"
                  value={image.caption}
                />
              </Field>
              <Field
                htmlFor={`entity-image-source-${image.key}`}
                label="Source URL"
                optional
              >
                <TextInput
                  disabled={disabled}
                  id={`entity-image-source-${image.key}`}
                  maxLength={2048}
                  onChange={(event) => {
                    const sourceUrl = event.currentTarget.value;
                    onChange(
                      images.map((candidate) =>
                        candidate.key === image.key
                          ? { ...candidate, sourceUrl }
                          : candidate,
                      ),
                    );
                  }}
                  placeholder="https://commons.wikimedia.org/wiki/File:…"
                  type="url"
                  value={image.sourceUrl}
                />
              </Field>
              <Field
                htmlFor={`entity-image-license-${image.key}`}
                label="License"
                optional
              >
                <TextInput
                  disabled={disabled}
                  id={`entity-image-license-${image.key}`}
                  maxLength={255}
                  onChange={(event) => {
                    const license = event.currentTarget.value;
                    onChange(
                      images.map((candidate) =>
                        candidate.key === image.key
                          ? { ...candidate, license }
                          : candidate,
                      ),
                    );
                  }}
                  placeholder="CC BY-SA 4.0"
                  value={image.license}
                />
              </Field>
              <div {...stylex.props(styles.actions)}>
                <label {...stylex.props(styles.primaryLabel)}>
                  <input
                    checked={image.isPrimary}
                    disabled={disabled}
                    name="primaryEntityImage"
                    onChange={() =>
                      onChange(
                        images.map((candidate) => ({
                          ...candidate,
                          isPrimary: candidate.key === image.key,
                        })),
                      )
                    }
                    type="radio"
                  />
                  Primary image
                </label>
                <Button
                  disabled={disabled}
                  onClick={() => {
                    const remaining = images.filter(
                      (candidate) => candidate.key !== image.key,
                    );
                    if (image.isPrimary && remaining[0]) {
                      remaining[0] = { ...remaining[0], isPrimary: true };
                    }
                    onChange(remaining);
                  }}
                  size="sm"
                  variant="text"
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ))}

        <input
          accept="image/*"
          disabled={disabled}
          multiple
          onChange={(event) => {
            if (event.currentTarget.files?.length) {
              addFiles(event.currentTarget.files);
            }
            event.currentTarget.value = "";
          }}
          ref={inputRef}
          type="file"
          {...stylex.props(styles.fileInput)}
        />
        <Button
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          variant="tonal"
        >
          <ImagePlus aria-hidden="true" size={16} />
          Add images
        </Button>
      </div>
    </FieldGroup>
  );
}

const styles = stylex.create({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: space.x4,
  },
  row: {
    alignItems: "start",
    borderBottomColor: colors.hairline,
    borderBottomStyle: "solid",
    borderBottomWidth: "1px",
    display: "grid",
    gap: space.x4,
    gridTemplateColumns: "112px minmax(0, 1fr)",
    paddingBottom: space.x4,
  },
  preview: {
    boxSizing: "border-box",
    backgroundColor: colors.imageBackground,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: "3px",
    height: "112px",
    objectFit: "contain",
    width: "112px",
  },
  fields: {
    display: "flex",
    flexDirection: "column",
    gap: space.x2,
    minWidth: 0,
  },
  actions: {
    alignItems: "center",
    display: "flex",
    gap: space.x3,
    justifyContent: "space-between",
  },
  primaryLabel: {
    alignItems: "center",
    color: colors.inkMuted,
    cursor: "pointer",
    display: "flex",
    gap: space.x2,
  },
  fileInput: {
    display: "none",
  },
});

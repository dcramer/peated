import type { ReactNode } from "react";
import { forwardRef, useEffect, useState } from "react";

import { type Point } from "@peated/server/src/types";
import { ClientOnly } from "./clientOnly";
import FormField from "./formField";
import { Map } from "./map.client";
import TextInput from "./textInput";

type Props = Omit<
  React.ComponentProps<typeof TextInput>,
  "value" | "onChange"
> & {
  label?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
  className?: string;
  value?: Point | null | undefined;
  error?: {
    message?: string;
  };
  onChange: (value: Point | null) => void;
};

export default forwardRef<HTMLInputElement, Props>(
  (
    { name, label, helpText, required, className, value, error, onChange },
    ref,
  ) => {
    const [position, setPosition] = useState<Point | null>(null);

    useEffect(() => {
      setPosition(value || null);
    }, [value]);

    return (
      <FormField
        label={label}
        htmlFor={`f-${name}`}
        required={required}
        helpText={helpText}
        className={className}
        error={error}
      >
        <div className="relative flex-col space-y-4">
          <TextInput
            name={name}
            placeholder="e.g. 352 North 1100 East, Lehi, UT 84043"
            onChange={(e) => {
              e.stopPropagation();

              const value = e.target.value;
              if (!value) setPosition(null);
              else {
                const [lat, lng] = value.split(",", 2).map(parseFloat);
                if (lat && lng) setPosition([lat, lng]);
                else setPosition(null);
              }
            }}
          />
          <LocationMap position={position} />
        </div>
      </FormField>
    );
  },
);

const LocationMap = ({ position }: { position: Point | null }) => {
  const mapHeight = "400px";
  const mapWidth = "100%";

  return (
    <ClientOnly
      fallback={
        <div
          className="animate-pulse bg-slate-800"
          style={{ height: mapHeight, width: mapWidth }}
        />
      }
    >
      {() => (
        <Map width={mapWidth} height={mapHeight} position={position} editable />
      )}
    </ClientOnly>
  );
};

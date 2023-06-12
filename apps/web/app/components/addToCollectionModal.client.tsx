import { Dialog } from "@headlessui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { CollectionBottleInputSchema } from "@peated/shared/schemas";

import { ApiError } from "~/lib/api";
import type { Bottle } from "~/types";
import BottleCard from "./bottleCard";
import Button from "./button";
import Fieldset from "./fieldset";
import FormError from "./formError";
import TextField from "./textField";

type FormSchemaType = z.infer<typeof CollectionBottleInputSchema>;

export default ({
  bottle,
  open,
  setOpen,
  onSubmit,
}: {
  bottle: Bottle;
  open: boolean;
  setOpen: (value: boolean) => void;
  onSubmit: SubmitHandler<FormSchemaType>;
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(CollectionBottleInputSchema),
    defaultValues: {
      bottle: bottle.id,
    },
  });

  const [error, setError] = useState<string | undefined>();

  const onSubmitHandler: SubmitHandler<FormSchemaType> = async (data) => {
    try {
      await onSubmit(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        console.error(err);
        setError("Internal error");
      }
    }
  };

  return (
    <Dialog open={open} as="div" className="dialog" onClose={setOpen}>
      <Dialog.Overlay className="fixed inset-0" />
      <Dialog.Panel className="dialog-panel flex items-center justify-center px-4 pb-4 pt-5 sm:p-6">
        <form
          className="max-w-md flex-1"
          onSubmit={handleSubmit(onSubmitHandler)}
        >
          <div className="sm:mb-3">
            <BottleCard bottle={bottle} color="highlight" />
          </div>

          {error && <FormError values={[error]} />}

          <Fieldset>
            <TextField
              {...register("vintageYear", {
                setValueAs: (v) =>
                  v === "" || !v ? undefined : parseInt(v, 10),
              })}
              error={errors.vintageYear}
              type="number"
              label="Year"
              placeholder="e.g. 2023"
            />
            <TextField
              {...register("barrel", {
                setValueAs: (v) =>
                  v === "" || !v ? undefined : parseInt(v, 10),
              })}
              error={errors.barrel}
              type="number"
              label="Barrel No."
              placeholder="e.g. 56"
            />
          </Fieldset>
          <div className="mt-5 flex flex-row-reverse gap-x-2 sm:mt-6">
            <Button color="primary" type="submit" disabled={isSubmitting}>
              Add to Collection
            </Button>
            <Button onClick={() => setOpen(false)} disabled={isSubmitting}>
              Close
            </Button>
          </div>
        </form>
      </Dialog.Panel>
    </Dialog>
  );
};

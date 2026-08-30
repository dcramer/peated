import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { useState } from "react";
import type { FieldValues, SubmitHandler } from "react-hook-form";

export function useAdminFormSubmit<Data extends FieldValues>(
  onSubmit: SubmitHandler<Data>,
) {
  const [error, setError] = useState<string>();
  const submit: SubmitHandler<Data> = async (data, event) => {
    setError(undefined);
    try {
      await onSubmit(data, event);
    } catch (caught) {
      setError(getFormErrorMessage(caught));
    }
  };

  return { error, submit };
}

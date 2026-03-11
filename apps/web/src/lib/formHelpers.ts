import { isDefinedError } from "@orpc/client";
import type { Option } from "@peated/web/components/selectField";
import { logError } from "@peated/web/lib/log";

type ChoiceValue = number | string;
type OptionLike = {
  id?: ChoiceValue | null;
  name?: string | null;
};
type OptionInput = ChoiceValue | OptionLike | null | undefined;

type GetFormErrorMessageOptions = {
  allowAnyErrorMessage?: boolean;
  expectedErrorNames?: string[];
  fallbackMessage?: string;
};

export function toOption(value: OptionInput): Option | undefined {
  if (
    value == null ||
    typeof value === "number" ||
    typeof value === "string" ||
    !value.name
  ) {
    return undefined;
  }

  return {
    id: value.id,
    name: value.name,
  };
}

export function toOptionList(
  values: OptionInput[] | null | undefined,
): Option[] {
  return values?.map((value) => toOption(value)).filter(isOption) ?? [];
}

export function toChoiceValue<T extends OptionLike>(
  value: ChoiceValue | T | null | undefined,
): ChoiceValue | T | null | undefined {
  if (value == null || typeof value === "number" || typeof value === "string") {
    return value;
  }

  return value.id ?? value;
}

export function getFormErrorMessage(
  err: unknown,
  options: GetFormErrorMessageOptions = {},
): string {
  const {
    allowAnyErrorMessage = false,
    expectedErrorNames = [],
    fallbackMessage = "Internal error",
  } = options;

  if (isDefinedError(err)) {
    return (err as Error).message;
  }

  if (
    err instanceof Error &&
    (allowAnyErrorMessage || expectedErrorNames.includes(err.name))
  ) {
    return err.message;
  }

  logError(err);
  return fallbackMessage;
}

function isOption(value: Option | undefined): value is Option {
  return value !== undefined;
}

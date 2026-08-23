import { isDefinedError } from "@orpc/client";
import type { Option } from "@peated/web/components/selectField";
import { logError } from "@peated/web/lib/log";
import { z } from "zod";

type ClientErrorCandidate = Parameters<typeof isDefinedError>[0];

type ChoiceValue = number | string;
type OptionLike<TValue extends ChoiceValue = ChoiceValue> = {
  id?: TValue | null;
  name?: string | null;
};
type OptionInput = ChoiceValue | OptionLike | null | undefined;

const ChoiceValueSchema = z.union([z.number(), z.string()]);
const ErrorMessageSchema = z.object({ message: z.string() });

type GetFormErrorMessageOptions = {
  allowAnyErrorMessage?: boolean;
  expectedErrorNames?: string[];
  fallbackMessage?: string;
};

export function toOption(value: OptionInput): Option | undefined {
  const option = z
    .object({
      id: ChoiceValueSchema.nullable().optional(),
      name: z.string().min(1),
    })
    .safeParse(value);
  if (!option.success) return undefined;

  return {
    id: option.data.id,
    name: option.data.name,
  };
}

export function toOptionList(
  values: OptionInput[] | null | undefined,
): Option[] {
  return values?.map((value) => toOption(value)).filter(isOption) ?? [];
}

export function toChoiceValue<
  TValue extends ChoiceValue,
  TOption extends OptionLike<TValue>,
>(
  value: TValue | TOption | null | undefined,
): TValue | TOption | null | undefined {
  if (value == null) return value;
  if (isOptionLike(value)) return value.id ?? value;
  return value;
}

export function getFormErrorMessage(
  err: ClientErrorCandidate,
  options: GetFormErrorMessageOptions = {},
): string {
  const {
    allowAnyErrorMessage = false,
    expectedErrorNames = [],
    fallbackMessage = "Internal error",
  } = options;

  if (isDefinedError(err)) {
    const error = ErrorMessageSchema.safeParse(err);
    if (error.success) return error.data.message;
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

function isOptionLike<
  TValue extends ChoiceValue,
  TOption extends OptionLike<TValue>,
>(value: TValue | TOption): value is TOption {
  return !ChoiceValueSchema.safeParse(value).success;
}

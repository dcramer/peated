import type { SearchPickerOption } from "../searchPicker.stylex";

export type Option = {
  bottle?: SearchPickerOption["bottle"];
  description?: string | null;
  id?: string | number | null;
  name: string;
  shortName?: string | null;
};

export type OnQuery<T extends Option> = (
  query: string,
  options: T[],
) => Promise<T[]>;

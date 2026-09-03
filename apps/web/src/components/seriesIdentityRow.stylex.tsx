import {
  TextIdentityRow,
  type TextIdentityRowProps,
} from "./textIdentityRow.stylex";

export type SeriesIdentityRowProps = Omit<
  TextIdentityRowProps,
  "metadata" | "status"
> & {
  brand?: string;
};

/** Series identity for search and lists. Release counts belong outside the identity. */
export function SeriesIdentityRow({ brand, ...props }: SeriesIdentityRowProps) {
  return <TextIdentityRow {...props} metadata={brand} />;
}

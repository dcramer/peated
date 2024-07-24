import { toTitleCase } from "@peated/server/lib/strings";
import type { CaskFill, CaskSize, CaskType } from "@peated/server/types";

export default function CaskDetails({
  caskFill,
  caskSize,
  caskType,
}: {
  caskFill: CaskFill | null;
  caskSize: CaskSize | null;
  caskType: CaskType | null;
}) {
  return (
    <div className="text-muted">
      {caskFill ? toTitleCase(caskFill) : ""}{" "}
      {caskType ? toTitleCase(caskType) : ""}{" "}
      {caskSize ? toTitleCase(caskSize) : ""}
    </div>
  );
}

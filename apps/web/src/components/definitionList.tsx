import { type ComponentPropsWithoutRef } from "react";

export function DefinitionTerm(props: ComponentPropsWithoutRef<"dt">) {
  return <dt className="mfont-semibold" {...props} />;
}

export function DefinitionDetails(props: ComponentPropsWithoutRef<"dd">) {
  return (
    <dd className="text-muted mb-4 flex items-center gap-x-2" {...props} />
  );
}

export default function DefinitionList(props: ComponentPropsWithoutRef<"dl">) {
  return <dl className="grid-cols mb-4 grid grid-cols-1" {...props} />;
}

DefinitionList.Details = DefinitionDetails;

DefinitionList.Term = DefinitionTerm;

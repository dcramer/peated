import { type ComponentPropsWithoutRef } from "react";

export function DefinitionTerm(props: ComponentPropsWithoutRef<"dt">) {
  return <dt className="font-semibold leading-6" {...props} />;
}

export function DefinitionDetails(props: ComponentPropsWithoutRef<"dd">) {
  return (
    <dd className="text-muted flex items-center gap-x-2 leading-6" {...props} />
  );
}

export default function DefinitionList(props: ComponentPropsWithoutRef<"dl">) {
  return <dl className="grid-cols mb-4 grid grid-cols-1 gap-y-4" {...props} />;
}

DefinitionList.Details = DefinitionDetails;

DefinitionList.Term = DefinitionTerm;

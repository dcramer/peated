import { type ComponentPropsWithoutRef } from "react";

export function Term(props: ComponentPropsWithoutRef<"dt">) {
  return <dt className="font-semibold leading-6" {...props} />;
}

export function Details(props: ComponentPropsWithoutRef<"dd">) {
  return (
    <dd className="text-light flex items-center gap-x-2 leading-6" {...props} />
  );
}

export default function DefinitionList(props: ComponentPropsWithoutRef<"dl">) {
  return <dl className="grid-cols mb-4 grid grid-cols-1 gap-y-4" {...props} />;
}

DefinitionList.Details = Details;

DefinitionList.Term = Term;

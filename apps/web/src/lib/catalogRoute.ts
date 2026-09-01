import { notFound } from "next/navigation";

export function parseCatalogRouteId(value: string): number {
  const match = /^([1-9]\d*)(?:-(.+))?$/u.exec(value);
  if (!match) notFound();

  const id = Number(match[1]);
  if (!Number.isSafeInteger(id)) notFound();
  return id;
}

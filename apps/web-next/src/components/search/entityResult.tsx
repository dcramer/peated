import type { Entity } from "@peated/server/types";
import EntityIcon from "@peated/web/assets/entity.svg";
import Link from "next/link";
import Chip from "../chip";

export type EntityResult = {
  type: "entity";
  ref: Entity;
};

export default function EntityResultRow({
  result: { ref: entity },
}: {
  result: EntityResult;
}) {
  return (
    <>
      <EntityIcon className="m-2 hidden h-10 w-auto sm:block" />

      <div className="flex min-w-0 flex-auto">
        <div className="flex-auto font-semibold leading-6">
          <Link href={`/entities/${entity.id}`}>
            <span className="absolute inset-x-0 -top-px bottom-0" />
            {entity.name}
          </Link>
        </div>
        <div className="flex gap-x-2">
          {entity.type.map((t) => (
            <Chip key={t} size="small" color="highlight">
              {t}
            </Chip>
          ))}
        </div>
      </div>
    </>
  );
}

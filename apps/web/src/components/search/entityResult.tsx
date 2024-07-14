import type { Entity } from "@peated/server/types";
import EntityIcon from "@peated/web/assets/entity.svg";
import Link from "@peated/web/components/link";
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
        <div className="flex items-center space-x-1 font-semibold leading-6">
          <Link href={`/entities/${entity.id}`}>
            <span className="absolute inset-x-0 -top-px bottom-0" />
            {entity.name}
          </Link>
          <div className="text-light mt-1 flex gap-x-1 truncate text-sm leading-5">
            {entity.shortName}
          </div>
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

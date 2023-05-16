import { Link } from "react-router-dom";

import { Entity } from "../types";
import Button from "./button";
import Chip from "./chip";

export default ({
  entityList,
  rel,
}: {
  entityList: Entity[];
  rel?: {
    next: string | null;
    nextPage: number | null;
    prev: string | null;
    prevPage: number | null;
  };
}) => {
  return (
    <>
      <table className="min-w-full">
        <colgroup>
          <col className="min-w-full sm:w-1/2" />
          <col className="sm:w-1/2" />
        </colgroup>
        <thead className="border-b border-slate-800 text-sm font-semibold text-slate-500">
          <tr>
            <th scope="col" className="px-3 py-2.5 text-left">
              Entity
            </th>
            <th
              scope="col"
              className="hidden px-3 py-2.5 text-right sm:table-cell"
            >
              Location
            </th>
          </tr>
        </thead>
        <tbody>
          {entityList.map((entity) => {
            return (
              <tr key={entity.id} className="border-b border-slate-800 text-sm">
                <td className="max-w-0 px-3 py-3">
                  <Link
                    to={`/entities/${entity.id}`}
                    className="font-medium hover:underline"
                  >
                    {entity.name}
                  </Link>
                  <div className="mt-2 space-x-2">
                    {entity.type.sort().map((t) => (
                      <Chip key={t} size="small">
                        {t}
                      </Chip>
                    ))}
                  </div>
                </td>
                <td className="hidden px-3 py-3 text-right sm:table-cell">
                  {entity.country}
                  <br /> {entity.region || ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rel && (
        <nav
          className="flex items-center justify-between py-3"
          aria-label="Pagination"
        >
          <div className="flex flex-1 justify-between gap-x-2 sm:justify-end">
            <Button
              to={rel.prevPage ? `?page=${rel.prevPage}` : undefined}
              disabled={!rel.prevPage}
            >
              Previous
            </Button>
            <Button
              to={rel.nextPage ? `?page=${rel.nextPage}` : undefined}
              disabled={!rel.nextPage}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </>
  );
};

import { Link } from "react-router-dom";

import { Entity } from "../types";
import Button from "./button";

export default ({
  distillerList,
  rel,
}: {
  distillerList: Entity[];
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
          <col className="sm:w-1/6" />
          <col className="sm:w-1/6" />
        </colgroup>
        <thead className="border-b border-slate-800 text-sm font-semibold text-slate-500 ">
          <tr>
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left sm:pl-3">
              Distiller
            </th>
            <th
              scope="col"
              className="hidden px-3 py-3.5 text-right sm:table-cell"
            >
              Country
            </th>
            <th scope="col" className="py-3.5 pl-3 pr-4 text-right sm:pr-3">
              Region
            </th>
          </tr>
        </thead>
        <tbody>
          {distillerList.map((distiller) => {
            return (
              <tr key={distiller.id} className="border-b border-slate-800">
                <td className="max-w-0 py-4 pl-4 pr-3 text-sm sm:pl-3">
                  <Link
                    to={`/entities/${distiller.id}`}
                    className="font-medium hover:underline"
                  >
                    {distiller.name}
                  </Link>
                </td>
                <td className="hidden px-3 py-4 text-right text-sm sm:table-cell">
                  {distiller.country}
                </td>
                <td className="hidden py-4 pl-3 pr-4 text-right text-sm sm:table-cell sm:pr-3">
                  {distiller.region || ""}
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

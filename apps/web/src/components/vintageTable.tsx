import { Edition, PagingRel } from "../types";
import Button from "./button";

const EditionName = ({ edition }: { edition: Edition }) => {
  const name =
    edition.name && edition.vintageYear
      ? `${edition.name} - ${edition.vintageYear}`
      : `${edition.name || edition.vintageYear}`;
  return (
    <>
      {name}
      {!!edition.barrel && ` (#${edition.barrel.toLocaleString()})`}
    </>
  );
};

export default ({ values, rel }: { values: Edition[]; rel?: PagingRel }) => {
  return (
    <>
      <table className="min-w-full">
        <colgroup>
          <col className="min-w-full sm:w-1/2" />
        </colgroup>
        <thead className="border-b border-slate-800 text-sm font-semibold text-slate-500">
          <tr>
            <th scope="col" className="px-3 py-2.5 text-left">
              Vintage
            </th>
          </tr>
        </thead>
        <tbody>
          {values.map((edition) => {
            return (
              <tr
                key={edition.id}
                className="border-b border-slate-800 text-sm"
              >
                <td className="max-w-0 px-3 py-3">
                  <EditionName edition={edition} />
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

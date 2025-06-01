import Link from "@peated/web/components/link";

import type { PagingRel, Review } from "@peated/server/types";
import PaginationButtons from "../paginationButtons";

export default function ReviewTable({
  reviewList,
  rel,
}: {
  reviewList: Review[];
  rel?: PagingRel;
}) {
  return (
    <>
      <table className="min-w-full">
        <colgroup>
          <col className="min-w-full sm:w-1/2" />
          <col className="sm:w-1/2" />
        </colgroup>
        <thead className="hidden border-slate-800 border-b font-semibold text-muted text-sm sm:table-header-group">
          <tr>
            <th scope="col" className="px-3 py-2.5 text-left">
              Name
            </th>
            <th
              scope="col"
              className="hidden px-3 py-2.5 text-right sm:table-cell"
            >
              Rating
            </th>
          </tr>
        </thead>
        <tbody>
          {reviewList.map((review) => {
            return (
              <tr
                key={review.name}
                className="border-slate-800 border-b text-sm"
              >
                <td className="max-w-0 px-3 py-3">
                  <Link
                    href={review.url}
                    className="font-semibold hover:underline"
                  >
                    {review.name}
                  </Link>
                  <div className="mt-2 space-x-2 text-xs">
                    {review.bottle ? (
                      <Link
                        href={`/bottles/${review.bottle.id}`}
                        className="hover:underline"
                      >
                        [{review.bottle.id}] ({review.bottle.fullName})
                      </Link>
                    ) : (
                      <em>No Bottle</em>
                    )}
                  </div>
                </td>
                <td className="hidden px-3 py-3 text-right sm:table-cell">
                  {review.rating}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <PaginationButtons rel={rel} />
    </>
  );
}

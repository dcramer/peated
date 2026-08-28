import Link from "@peated/web/components/link";

import type { ExternalReview, PagingRel } from "@peated/server/types";
import PaginationButtons from "../paginationButtons";

export default function ExternalReviewTable({
  externalReviewList,
  rel,
}: {
  externalReviewList: ExternalReview[];
  rel?: PagingRel;
}) {
  return (
    <>
      <ExternalReviewRows externalReviewList={externalReviewList} />
      <PaginationButtons rel={rel} />
    </>
  );
}

export function ExternalReviewRows({
  externalReviewList,
}: {
  externalReviewList: ExternalReview[];
}) {
  return (
    <>
      <table className="min-w-full">
        <colgroup>
          <col className="min-w-full sm:w-1/2" />
          <col className="sm:w-1/2" />
        </colgroup>
        <thead className="text-muted hidden border-b border-slate-800 text-sm font-semibold sm:table-header-group">
          <tr>
            <th scope="col" className="px-3 py-2.5 text-left">
              Name
            </th>
            <th
              scope="col"
              className="hidden px-3 py-2.5 text-right sm:table-cell"
            >
              Source score
            </th>
          </tr>
        </thead>
        <tbody>
          {externalReviewList.map((externalReview) => {
            return (
              <tr
                key={externalReview.id}
                className="border-b border-slate-800 text-sm"
              >
                <td className="max-w-0 px-3 py-3">
                  <Link
                    href={externalReview.url}
                    className="font-semibold hover:underline"
                  >
                    {externalReview.name}
                  </Link>
                  <div className="mt-2 space-x-2 text-xs">
                    {externalReview.bottle ? (
                      <Link
                        href={`/bottles/${externalReview.bottle.id}`}
                        className="font-semibold hover:underline"
                      >
                        {externalReview.bottle.fullName}
                      </Link>
                    ) : (
                      <em>No Bottle</em>
                    )}
                  </div>
                </td>
                <td className="hidden px-3 py-3 text-right sm:table-cell">
                  {externalReview.nativeScore?.display ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

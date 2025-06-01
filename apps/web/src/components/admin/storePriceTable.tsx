import type { Bottle, PagingRel, StorePrice } from "@peated/server/types";
import { Link } from "@tanstack/react-router";
import Price from "@peated/web/components/price";
import PaginationButtons from "../paginationButtons";

export default function StorePriceTable({
  priceList,
  rel,
}: {
  priceList: (StorePrice & {
    bottle?: Bottle;
  })[];
  rel?: PagingRel;
}) {
  return (
    <>
      <table className="min-w-full">
        <colgroup>
          <col className="min-w-full sm:w-1/12" />
          <col className="min-w-full sm:w-7/12" />
          <col className="sm:w-2/12" />
          <col className="sm:w-2/12" />
        </colgroup>
        <thead className="hidden border-slate-800 border-b font-semibold text-muted text-sm sm:table-header-group">
          <tr>
            <th scope="col" className="px-3 py-2.5 text-left" />
            <th scope="col" className="px-3 py-2.5 text-left">
              Name
            </th>
            <th
              scope="col"
              className="hidden px-3 py-2.5 text-right sm:table-cell"
            >
              Price
            </th>
          </tr>
        </thead>
        <tbody>
          {priceList.map((price) => {
            return (
              <tr
                key={price.name}
                className="border-slate-800 border-b text-sm"
              >
                <td>
                  {price.imageUrl && (
                    <img
                      src={price.imageUrl}
                      className="max-h-16 max-w-full"
                      alt="image of bottle"
                    />
                  )}
                </td>
                <td className="max-w-0 px-3 py-3">
                  <Link to={price.url} className="font-medium hover:underline">
                    {price.name}
                  </Link>
                  <div className="mt-2 space-x-2 text-xs">
                    {price.bottle ? (
                      <Link
                        to="/bottles/$bottleId"
                        params={{ bottleId: String(price.bottle.id) }}
                      >
                        Bottle {price.bottle.id}
                      </Link>
                    ) : (
                      <em>No Bottle</em>
                    )}
                  </div>
                </td>
                <td className="hidden px-3 py-3 text-right sm:table-cell">
                  <Price value={price.price} currency={price.currency} />
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

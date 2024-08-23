import type { Bottle, PagingRel, StorePrice } from "@peated/server/types";
import Link from "@peated/web/components/link";
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
          <col className="min-w-full sm:w-8/12" />
          <col className="sm:w-3/12" />
        </colgroup>
        <thead className="text-muted hidden border-b border-slate-800 text-sm font-semibold sm:table-header-group">
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
                className="border-b border-slate-800 text-sm"
              >
                <td>
                  {price.imageUrl && (
                    <img src={price.imageUrl} className="max-h-16 max-w-full" />
                  )}
                </td>
                <td className="max-w-0 px-3 py-3">
                  <Link
                    href={price.url}
                    className="font-medium hover:underline"
                  >
                    {price.name}
                  </Link>
                  <div className="mt-2 space-x-2 text-xs">
                    {price.bottle ? (
                      <Link href={`/bottles/${price.bottle.id}`}>
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

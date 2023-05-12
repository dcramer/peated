import { Link } from 'react-router-dom'

import { Entity } from '../types'
import Button from './button'

export default ({
  brandList,
  rel,
}: {
  brandList: Entity[]
  rel?: {
    next: string | null
    nextPage: number | null
    prev: string | null
    prevPage: number | null
  }
}) => {
  return (
    <>
      <table className="min-w-full">
        <colgroup>
          <col className="min-w-full sm:w-1/2" />
          <col className="sm:w-1/6" />
          <col className="sm:w-1/6" />
        </colgroup>
        <thead className="border-b border-gray-300 text-gray-900">
          <tr>
            <th
              scope="col"
              className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-3"
            >
              Brand
            </th>
            <th
              scope="col"
              className="hidden px-3 py-3.5 text-right text-sm font-semibold text-gray-900 sm:table-cell"
            >
              Country
            </th>
            <th
              scope="col"
              className="py-3.5 pl-3 pr-4 text-right text-sm font-semibold text-gray-900 sm:pr-3"
            >
              Region
            </th>
          </tr>
        </thead>
        <tbody>
          {brandList.map((brand) => {
            return (
              <tr key={brand.id} className="border-b border-gray-200">
                <td className="max-w-0 py-4 pl-4 pr-3 text-sm sm:pl-3">
                  <Link
                    to={`/brands/${brand.id}`}
                    className="text-peated font-bold hover:underline"
                  >
                    {brand.name}
                  </Link>
                </td>
                <td className="hidden px-3 py-4 text-right text-sm text-gray-500 sm:table-cell">
                  {brand.country}
                </td>
                <td className="hidden py-4 pl-3 pr-4 text-right text-sm text-gray-500 sm:table-cell sm:pr-3">
                  {brand.region || ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rel && (
        <nav
          className="flex items-center justify-between border-t border-gray-200 bg-white py-3"
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
  )
}

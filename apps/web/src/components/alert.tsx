import { XCircleIcon } from '@heroicons/react/20/solid'
import { ReactNode } from 'react'

export default ({ children }: { children: ReactNode }) => {
  return (
    <div className="mb-4 bg-red-50 p-4 sm:rounded">
      <div className="flex">
        <div className="flex-shrink-0">
          <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
        </div>
        <div className="ml-3 text-red-800">{children}</div>
      </div>
    </div>
  )
}

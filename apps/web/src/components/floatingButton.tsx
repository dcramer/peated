import { PlusIcon } from '@heroicons/react/20/solid'
import { Link } from 'react-router-dom'

export default ({ to }: { to: string }) => {
  return (
    <Link
      type="button"
      className="bg-peated hover:bg-peated-dark focus-visible:outline-peated fixed bottom-8 right-8 rounded-full p-2 text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      to={to}
    >
      <PlusIcon className="h-8 w-8" aria-hidden="true" />
    </Link>
  )
}

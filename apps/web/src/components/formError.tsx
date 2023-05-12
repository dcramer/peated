import { ReactNode } from 'react'
import Alert from './alert'

export default ({ values }: { values: ReactNode[] }) => {
  return (
    <Alert>
      <h3 className="text-sm font-medium text-red-800">
        There was an error with your submission
      </h3>
      <div className="mt-2 text-sm text-red-700">
        <ul role="list" className="list-disc space-y-1 pl-5">
          {values.map((v) => (
            <li>{v}</li>
          ))}
        </ul>
      </div>
    </Alert>
  )
}

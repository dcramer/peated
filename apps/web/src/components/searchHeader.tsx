import { ChevronLeftIcon } from '@heroicons/react/20/solid'
import { ReactNode, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SearchHeader({
  name,
  onClose,
  onChange,
  onSubmit,
  onDone,
  placeholder,
  closeIcon = <ChevronLeftIcon className="h-8 w-8" />,
  ...props
}: {
  value?: string
  name?: string
  placeholder?: string
  closeIcon?: ReactNode
  onClose?: () => void
  onDone?: () => void
  onChange?: (value: string) => void
  onSubmit?: (value: string) => void
}) {
  const navigate = useNavigate()
  const [value, setValue] = useState(props.value || '')

  const blockStyles = `px-0 py-1 sm:py-3`

  return (
    <nav className="flex min-w-full items-center justify-between text-white">
      <div className="flex text-white hover:text-white">
        <button
          onClick={() => (onClose ? onClose() : navigate(-1))}
          className={`-m-1.5 p-1.5 ${blockStyles} pr-3 outline-0 sm:pr-6`}
        >
          <span className="sr-only">Back</span>
          <span className="h-10 w-10">{closeIcon}</span>
        </button>
      </div>
      <form
        className={`flex-1`}
        onSubmit={(e) => {
          e.preventDefault()

          if (onSubmit) onSubmit(value)
          else if (onChange) onChange(value)
        }}
      >
        <input
          autoFocus
          name={name}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            setValue(e.target.value)
            if (onChange) onChange(e.target.value)
          }}
          className="focus:outline-peated-light bg-peated-darker min-w-full rounded px-2 py-1.5 text-white focus:outline sm:px-3 sm:py-2"
        />
      </form>
      {onDone && (
        <div className="flex">
          <button
            onClick={onDone}
            className={`group min-h-full ${blockStyles} pl-3 sm:pl-6`}
          >
            <span className="bg-peated-dark group-hover:bg-peated-darker focus-visible:outline-peated rounded p-2.5 font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              Done
            </span>
          </button>
        </div>
      )}
    </nav>
  )
}

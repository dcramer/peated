import { ChevronRightIcon } from '@heroicons/react/20/solid'
import { ReactNode } from 'react'
import classNames from '../lib/classNames'
import FormLabel from './formLabel'
import HelpText from './helpText'

type Props = React.ComponentPropsWithoutRef<'div'> & {
  label?: string
  htmlFor?: string
  helpText?: string
  required?: boolean
  children?: ReactNode
  className?: string
  labelAction?: () => void
  onClick?: () => void
}

export default ({
  className,
  children,
  required,
  label,
  helpText,
  htmlFor,
  labelAction,
  onClick,
}: Props) => {
  return (
    <div
      className={classNames(
        `focus:gray-100 relative block bg-white px-3 pb-2.5 pt-2.5 focus-within:z-10 hover:bg-gray-100`,
        className,
        onClick ? 'cursor-pointer' : '',
      )}
      onClick={onClick}
    >
      {label && (
        <FormLabel
          htmlFor={htmlFor}
          required={required}
          className="flex flex-1 cursor-pointer items-center"
        >
          {label}
          {labelAction && (
            <ChevronRightIcon className="color-peated ml-1 inline-block h-5 font-bold" />
          )}
        </FormLabel>
      )}
      {children}
      {false && helpText && <HelpText>{helpText}</HelpText>}
    </div>
  )
}

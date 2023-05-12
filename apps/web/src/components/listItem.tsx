import { motion } from 'framer-motion'
import { ElementType, ReactNode } from 'react'
import classNames from '../lib/classNames'

export default ({
  children,
  noHover = false,
  as: Component = 'li',
}: {
  children?: ReactNode
  noHover?: boolean
  as?: ElementType
}) => {
  return (
    <Component
      className={classNames(
        'group relative bg-white py-5',
        noHover ? '' : 'hover:bg-gray-100',
      )}
    >
      <motion.div
        className="mx-auto max-w-7xl justify-between gap-x-6 px-4 sm:px-6 lg:px-8"
        layout
      >
        <div className="flex items-center gap-x-4">{children}</div>
      </motion.div>
    </Component>
  )
}

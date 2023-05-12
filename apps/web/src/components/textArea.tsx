export default ({ ...props }: React.ComponentPropsWithoutRef<'textarea'>) => {
  const baseStyles = 'bg-white rounded border-0 text-gray-900 focus:ring-0'
  const inputStyles = 'text-gray-900 placeholder:text-gray-400 sm:leading-6'
  return (
    <textarea
      className={`block min-w-full p-0 ${baseStyles} ${inputStyles}`}
      {...props}
    />
  )
}

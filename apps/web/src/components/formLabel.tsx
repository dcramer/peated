export default ({
  className,
  required,
  ...props
}: { required?: boolean } & React.ComponentPropsWithoutRef<'label'>) => {
  return (
    <div className="mb-2 flex justify-between">
      <label
        {...props}
        className={`block font-bold leading-6 text-gray-800 ${className || ''}`}
      />
      {!required && (
        <span className="text-xs leading-6 text-gray-400">Optional</span>
      )}
    </div>
  )
}

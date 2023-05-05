export default ({
  className,
  required,
  ...props
}: { required?: boolean } & React.ComponentPropsWithoutRef<"label">) => {
  return (
    <div className="flex justify-between">
      <label
        {...props}
        className={`block text-sm font-bold leading-6 text-gray-800 ${
          className || ""
        }`}
      />
      {!required && (
        <span className="text-xs leading-6 text-gray-400">Optional</span>
      )}
    </div>
  );
};

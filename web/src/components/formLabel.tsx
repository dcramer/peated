export default ({ className, ...props }) => {
  return (
    <label
      {...props}
      className={`block text-sm font-medium leading-6 text-gray-900 ${
        className || ""
      }`}
    />
  );
};

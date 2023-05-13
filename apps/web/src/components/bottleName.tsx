export default ({
  bottle,
}: {
  bottle: {
    name: string;
    brand?: {
      name: string;
    };
  };
}) => {
  return (
    <>
      {bottle.brand?.name || ""} {bottle.name}
    </>
  );
};

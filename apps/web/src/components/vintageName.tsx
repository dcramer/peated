export default ({
  series,
  vintageYear,
  barrel,
}: {
  series?: string;
  vintageYear?: number;
  barrel?: number;
}) => {
  const displayName =
    series && vintageYear
      ? `${series} - ${vintageYear}`
      : `${series || vintageYear}`;
  return (
    <>
      {displayName}
      {!!barrel && ` (#${barrel.toLocaleString()})`}
    </>
  );
};

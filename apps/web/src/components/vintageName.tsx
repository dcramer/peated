export default ({
  series,
  vintageYear,
  barrel,
}: {
  series?: string;
  vintageYear?: number;
  barrel?: number;
}) => {
  if (!series && !vintageYear && !barrel) return null;
  const displayName =
    series && vintageYear
      ? `${series} - ${vintageYear}`
      : `${series || vintageYear}`;
  return (
    <>
      {displayName}
      {!!barrel && ` (Barrel ${barrel.toLocaleString()})`}
    </>
  );
};

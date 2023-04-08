import RelationSelect from "./relationSelect";

export default () => {
  return (
    <RelationSelect
      label="Brand"
      endpoint="/brands"
      helperText="The brand whom bottles the spirit."
      dialogTitle="Add Brand"
    />
  );
};

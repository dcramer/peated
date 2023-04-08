import RelationSelect from "./relationSelect";

export default (props) => {
  return (
    <RelationSelect
      label="Brand"
      endpoint="/brands"
      helperText="The brand whom bottles the spirit."
      dialogTitle="Add Brand"
      {...props}
    />
  );
};

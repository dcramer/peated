import RelationSelect from "./relationSelect";

export default (props) => {
  return (
    <RelationSelect
      label="Distiller"
      endpoint="/distillers"
      helperText="The distiller whom produces the spirit. Sometimes the same as the brand."
      dialogTitle="Add Distiller"
      {...props}
    />
  );
};

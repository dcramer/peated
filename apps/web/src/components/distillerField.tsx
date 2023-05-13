import CountryField from "./countryField";
import SelectField from "./selectField";
import TextField from "./textField";

export default (props: React.ComponentProps<typeof SelectField>) => {
  return (
    <SelectField
      label="Distiller"
      {...props}
      endpoint="/entities"
      createForm={({ data, onFieldChange }) => {
        return (
          <>
            <p className="mb-4">
              The distiller is the group that makes the spirit.
            </p>
            <TextField
              autoFocus
              label="Name"
              name="name"
              type="text"
              placeholder="e.g. Macallan"
              required
              defaultValue={data.name}
              autoComplete="off"
              onChange={(e) =>
                onFieldChange({ [e.target.name]: e.target.value })
              }
            />
            <CountryField
              name="country"
              label="Country"
              placeholder="e.g. Scotland, United States of America"
              required
              value={data.country}
              onChange={(value) => onFieldChange({ country: value })}
            />
            <TextField
              name="region"
              label="Region"
              type="text"
              placeholder="e.g. Islay, Kentucky"
              autoComplete="off"
              defaultValue={data.region}
              onChange={(e) =>
                onFieldChange({ [e.target.name]: e.target.value })
              }
            />
          </>
        );
      }}
    />
  );
};

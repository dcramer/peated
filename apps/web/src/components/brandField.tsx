import CountryField from "./countryField";
import SelectField from "./selectField";
import TextField from "./textField";

export default (props: React.ComponentProps<typeof SelectField>) => {
  return (
    <SelectField
      endpoint="/entities"
      createForm={({ data, onFieldChange }) => {
        return (
          <>
            <p className="mb-4">
              The brand is the group that bottles the spirit. Sometimes this is
              the same as the distiller.
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
              placeholder="e.g. Scotland"
              required
              value={data.country}
              onChange={(value) => onFieldChange({ country: value })}
            />
            <TextField
              name="region"
              label="Region"
              type="text"
              placeholder="e.g. Islay"
              autoComplete="off"
              defaultValue={data.region}
              onChange={(e) =>
                onFieldChange({ [e.target.name]: e.target.value })
              }
            />
          </>
        );
      }}
      {...props}
      label="Brand"
    />
  );
};

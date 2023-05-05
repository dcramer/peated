import CountryField from "./countryField";
import RichSelectField from "./richSelectField";
import TextField from "./textField";

type Props = Omit<
  React.ComponentProps<typeof RichSelectField>,
  "endpoint" | "options" | "suggestedItems" | "createForm"
>;

export default (props: Props) => {
  return (
    <RichSelectField
      label="Distiller"
      {...props}
      endpoint="/distillers"
      createForm={({ data, onFieldChange }) => {
        return (
          <>
            <p className="text-base mb-4">
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
              placeholder="e.g. Scotland"
              required
              defaultValue={data.country}
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
    />
  );
};

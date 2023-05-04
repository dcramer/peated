import CountryField from "./countryField";
import TextField from "./textField";
import Typeahead from "./typeahead";

export default ({ ...props }) => {
  return (
    <Typeahead
      placeholder="e.g. Macallan"
      {...props}
      endpoint="/brands"
      createForm={({ data, onFieldChange }) => {
        return (
          <>
            <p className="text-base mb-4">
              The brand is also known as the producer, or in some cases the
              bottler. Its also not unusual that distiller and the brand are the
              same, but its equally common to find brands who simply bottle
              other distiller's spirits.
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

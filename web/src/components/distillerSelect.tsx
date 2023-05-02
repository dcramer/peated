import FormField from "./formField";
import FormLabel from "./formLabel";
import TextInput from "./textInput";
import Typeahead from "./typeahead";

export default ({ ...props }) => {
  return (
    <Typeahead
      {...props}
      placeholder="e.g. Macallan"
      endpoint="/distillers"
      createForm={({ data, onFieldChange }) => {
        return (
          <>
            <p className="text-base mb-4">
              The distiller is group that makes the spirit.
            </p>
            <FormField>
              <FormLabel htmlFor="name">Name</FormLabel>
              <TextInput
                autoFocus
                id="name"
                name="name"
                type="text"
                placeholder="e.g. Macallan"
                required
                defaultValue={data.name}
                onChange={(e) =>
                  onFieldChange({ [e.target.name]: e.target.value })
                }
              />
            </FormField>
            <FormField>
              <FormLabel htmlFor="country">Country</FormLabel>
              <TextInput
                autoFocus
                name="country"
                type="text"
                placeholder="e.g. Scotland"
                required
                defaultValue={data.country}
                onChange={(e) =>
                  onFieldChange({ [e.target.name]: e.target.value })
                }
              />
            </FormField>
            <FormField>
              <FormLabel htmlFor="region">Region</FormLabel>
              <TextInput
                name="region"
                type="text"
                placeholder="e.g. Islay"
                defaultValue={data.region}
                onChange={(e) =>
                  onFieldChange({ [e.target.name]: e.target.value })
                }
              />
            </FormField>
          </>
        );
      }}
    />
  );
};

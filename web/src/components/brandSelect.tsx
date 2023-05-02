import FormField from "./formField";
import FormLabel from "./formLabel";
import TextInput from "./textInput";
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

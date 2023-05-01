import TextInput from "./textInput";
import Typeahead from "./typeahead";

export default (props) => {
  return (
    <Typeahead
      {...props}
      placeholder="e.g. Macallan"
      endpoint="/brands"
      createForm={({ data, onFieldChange }) => {
        return (
          <>
            Who are we missing?
            <TextInput
              autoFocus
              name="name"
              type="text"
              placeholder="e.g. Macallan"
              required
              value={data.name}
              onChange={(e) =>
                onFieldChange({ [e.target.name]: e.target.value })
              }
            />
            <TextInput
              autoFocus
              name="country"
              type="text"
              placeholder="e.g. Scotland"
              required
              value={data.country}
              onChange={(e) =>
                onFieldChange({ [e.target.name]: e.target.value })
              }
            />
            <TextInput
              name="region"
              type="text"
              placeholder="e.g. Islay"
              value={data.region}
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

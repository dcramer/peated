import { DialogContentText, TextField } from "@mui/material";
import RelationSelect from "./relationSelect";

export default (props) => {
  return (
    <RelationSelect
      {...props}
      label="Brand"
      endpoint="/brands"
      helperText="The brand whom bottles the spirit."
      dialogTitle="Add Brand"
      createForm={({ data, onFieldChange }) => {
        return (
          <>
            <DialogContentText>Who are we missing?</DialogContentText>
            <TextField
              autoFocus
              margin="dense"
              name="name"
              label="Name"
              type="text"
              placeholder="e.g. Macallan"
              variant="standard"
              helperText="The brand whom bottles the spirit."
              fullWidth
              required
              value={data.name}
              onChange={(e) =>
                onFieldChange({ [e.target.name]: e.target.value })
              }
            />
            <TextField
              autoFocus
              margin="dense"
              name="country"
              label="Country"
              type="text"
              placeholder="e.g. Scotland"
              variant="standard"
              helperText="The country where this brand is produced."
              fullWidth
              required
              value={data.country}
              onChange={(e) =>
                onFieldChange({ [e.target.name]: e.target.value })
              }
            />
            <TextField
              autoFocus
              margin="dense"
              name="region"
              label="Region"
              type="text"
              placeholder="e.g. Islay"
              variant="standard"
              helperText="If applicable, the region where this brand is produced."
              fullWidth
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

import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  createFilterOptions,
  debounce,
} from "@mui/material";
import api from "../lib/api";

type GenericRelation = {
  name: string;
  [key: string]: any;
};

type InputValue = Omit<GenericRelation, "id"> & { inputValue?: string };

const filter = createFilterOptions<InputValue>();

export default function RelationSelect({
  endpoint,
  placeholder,
  label,
  helperText,
  dialogTitle,
}: {
  endpoint: string;
  label: string;
  placeholder?: string;
  helperText?: string;
  dialogTitle: string;
}) {
  const [value, setValue] = useState<InputValue | null>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<InputValue[]>([]);
  const [loading, setLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const handleClose = () => {
    setDialogValue({});
    setDialogOpen(false);
  };
  const [dialogValue, setDialogValue] = useState<GenericRelation>();
  const handleDialogSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValue({
      ...dialogValue,
    });
    handleClose();
  };

  const getResults = useMemo(
    () =>
      debounce(
        async (
          input: string,
          callback: (results?: readonly InputValue[]) => void
        ) => {
          const results = await api.get(endpoint, {
            query: { query: input || "" },
          });
          callback(results);
        },
        400
      ),
    []
  );

  useEffect(() => {
    let active = true;

    if (open) setLoading(true);
    getResults(value?.name || "", (results?: readonly InputValue[]) => {
      if (active) {
        setLoading(false);
        if (results) {
          setOptions([...results]);
        } else {
          setOptions([]);
        }
      }
    });

    return () => {
      active = false;
    };
  }, [value, getResults]);

  return (
    <>
      <Autocomplete
        open={open}
        onChange={(event, newValue) => {
          if (typeof newValue === "string") {
            // timeout to avoid instant validation of the dialog's form.
            setTimeout(() => {
              setDialogOpen(true);
              setDialogValue({
                name: newValue,
              });
            });
          } else if (newValue && newValue.name) {
            setDialogOpen(true);
            setDialogValue({
              name: newValue.inputValue,
            });
          } else {
            setValue(newValue);
          }
        }}
        onOpen={() => {
          setOpen(true);
        }}
        onClose={() => {
          setOpen(false);
        }}
        clearOnBlur
        selectOnFocus
        handleHomeEndKeys
        freeSolo
        filterOptions={(options, params) => {
          const filtered = filter(options, params);

          if (params.inputValue !== "") {
            filtered.push({
              inputValue: params.inputValue,
              name: `Add "${params.inputValue}"`,
            });
          }

          return filtered;
        }}
        filterSelectedOptions
        isOptionEqualToValue={(option, value) => option.name === value.name}
        getOptionLabel={(option) =>
          typeof option === "string" ? option : option.name
        }
        options={options}
        loading={loading}
        value={value}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder={placeholder}
            variant="outlined"
            required
            fullWidth
            helperText={helperText}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? (
                    <CircularProgress color="inherit" size={20} />
                  ) : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
      <Dialog open={dialogOpen} onClose={handleClose}>
        <form onSubmit={handleDialogSubmit}>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogContent>
            <DialogContentText>Who are we missing?</DialogContentText>
            <TextField
              autoFocus
              margin="dense"
              name="name"
              value={dialogValue?.name}
              onChange={(event) =>
                setDialogValue({
                  ...dialogValue,
                  name: event.target.value,
                })
              }
              label="Name"
              type="text"
              placeholder={placeholder}
              variant="standard"
              helperText={helperText}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="submit">Add</Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

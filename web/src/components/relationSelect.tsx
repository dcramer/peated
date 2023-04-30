import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  createFilterOptions,
  debounce,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import api from "../lib/api";

type GenericRelation = {
  name: string;
  [key: string]: any;
};

type InputValue = Omit<GenericRelation, "id"> & { inputValue?: string };

const filter = createFilterOptions<InputValue>();

// type CreateForm = ({
//   onFieldChange: (value: { [key: string]: any }) => void,
// }) => ReactNode;

export default function RelationSelect({
  endpoint,
  placeholder,
  label,
  helperText,
  dialogTitle,
  canCreate,
  onChange,
  createForm,
}: {
  endpoint: string;
  label: string;
  placeholder?: string;
  helperText?: string;
  dialogTitle: string;
  canCreate?: boolean;
  createForm?: (value: any) => ReactNode;
  onChange: (value: any) => void;
}) {
  const [value, setValue] = useState<InputValue | null>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<InputValue[]>([]);
  const [loading, setLoading] = useState(false);

  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [dialogOpen, setDialogOpen] = useState(false);
  const handleClose = () => {
    setDialogValue({});
    setDialogOpen(false);
  };
  const [dialogValue, setDialogValue] = useState<GenericRelation>();
  const handleDialogSubmit = (event: React.FormEvent<HTMLButtonElement>) => {
    event.stopPropagation();
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
    onChange(value);
  }, [value]);

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
        onChange={(_, newValue) => {
          if (canCreate && typeof newValue === "string") {
            // timeout to avoid instant validation of the dialog's form.
            setTimeout(() => {
              setDialogOpen(true);
              setDialogValue({
                name: newValue,
              });
            });
          } else if (canCreate && newValue && newValue.inputValue) {
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
        filterOptions={(options, params) => {
          const filtered = filter(options, params);

          if (canCreate && params.inputValue !== "") {
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
      {canCreate && createForm && (
        <Dialog open={dialogOpen} onClose={handleClose} fullScreen={fullScreen}>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogContent>
            {createForm({
              data: dialogValue || {},
              onFieldChange: (value: any) => {
                setDialogValue({
                  ...dialogValue,
                  ...value,
                });
              },
            })}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button onClick={handleDialogSubmit}>Add</Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Brand } from "../types";
import {
  Autocomplete,
  CircularProgress,
  TextField,
  debounce,
} from "@mui/material";
import api from "../lib/api";

export default function BrandSelect() {
  const [value, setValue] = useState<Brand | null>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<readonly Brand[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);

  const getBrands = useMemo(
    () =>
      debounce(
        async (
          input: string,
          callback: (results?: readonly Brand[]) => void
        ) => {
          const results = await api.get(`/brands`, {
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
    getBrands(inputValue, (results?: readonly Brand[]) => {
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
  }, [value, inputValue, getBrands]);

  return (
    <Autocomplete
      open={open}
      onInputChange={(event, newInputValue) => {
        setInputValue(newInputValue);
      }}
      onChange={(event: any, newValue: Brand | null) => {
        setOptions(newValue ? [newValue, ...options] : options);
        setValue(newValue);
      }}
      onOpen={() => {
        setOpen(true);
      }}
      onClose={() => {
        setOpen(false);
      }}
      filterOptions={(x) => x}
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
          label="Brand"
          name="brand"
          placeholder="e.g. Macallan"
          variant="outlined"
          required
          fullWidth
          helperText="The brand whom bottles the spirit."
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
  );
}

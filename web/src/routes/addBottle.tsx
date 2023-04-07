import { AddBox as AddIcon } from "@mui/icons-material";
import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useLocation } from "react-router-dom";
import BrandSelect from "../components/brandSelect";

function toTitleCase(value: string) {
  var words = value.toLowerCase().split(" ");
  for (var i = 0; i < words.length; i++) {
    words[i] = words[i][0].toUpperCase() + words[i].slice(1);
  }
  return words.join(" ");
}
export default function AddBottle() {
  const location = useLocation();

  const qs = new URLSearchParams(location.search);
  const name = qs.get("name") || "";

  const categoryList = [
    "blend",
    "blended_grain",
    "blended_malt",
    "blended_scotch",
    "bourbon",
    "rye",
    "single_grain",
    "single_malt",
    "spirit",
  ].map((c) => ({
    id: c,
    name: toTitleCase(c.replace("_", " ")),
  }));

  return (
    <Box
      sx={{
        marginTop: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Typography variant="h4" component="h4" gutterBottom>
        Add Bottle
      </Typography>

      <Box component="form" noValidate sx={{ mt: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <BrandSelect />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Distiller"
              name="distiller"
              placeholder="e.g. Macallan"
              variant="outlined"
              required
              helperText="The distiller whom produces the spirit. Sometimes the same as the brand."
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Bottle"
              name="name"
              placeholder="e.g. Macallan 12"
              variant="outlined"
              defaultValue={name}
              required
              helperText="The full name of the bottle, excluding its series."
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Series"
              name="series"
              placeholder="e.g. The Edition"
              variant="outlined"
              helperText="If applicable, the series of bottling."
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="ABV"
              required
              placeholder="e.g. 45"
              name="abv"
              type="number"
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
              variant="outlined"
              helperText="The alcohol content by volume."
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Age"
              placeholder="e.g. 12"
              name="age"
              type="number"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">years</InputAdornment>
                ),
              }}
              variant="outlined"
              helperText="If applicable, the number of years the spirit was aged."
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel id="category-label">Category</InputLabel>
              <Select
                fullWidth
                label="Category"
                name="category"
                variant="outlined"
                labelId="category-label"
              >
                {categoryList.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>The kind of spirit.</FormHelperText>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <Button
              fullWidth
              variant="contained"
              endIcon={<AddIcon />}
              size="large"
            >
              Save Bottle
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

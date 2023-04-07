import {
  Avatar,
  Box,
  Chip,
  FormControl,
  FormHelperText,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Rating,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useLoaderData } from "react-router-dom";
import api from "../lib/api";
import type { Bottle, User } from "../types";
import { useState } from "react";
import { Add as AddIcon } from "@mui/icons-material";

function toTitleCase(value: string) {
  var words = value.toLowerCase().split(" ");
  for (var i = 0; i < words.length; i++) {
    words[i] = words[i][0].toUpperCase() + words[i].slice(1);
  }
  return words.join(" ");
}
export default function AddBottle() {
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
            <TextField
              fullWidth
              label="Brand"
              name="brand"
              placeholder="e.g. Macallan"
              variant="outlined"
              required
              helperText="The brand whom bottles the spirit."
            />
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
                  <MenuItem value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
              <FormHelperText>The kind of spirit.</FormHelperText>
            </FormControl>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

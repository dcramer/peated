import {
  AccountCircle as AccountCircleIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardHeader,
  TextField,
} from "@mui/material";
import { red } from "@mui/material/colors";
import { Bottle } from "../types";

import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { FormEvent, useEffect, useState } from "react";

export default function Search() {
  const location = useLocation();
  const navigate = useNavigate();

  const [results, setResults] = useState<Bottle[]>([]);

  // TODO(dcramer): why is this rendering twice
  useEffect(() => {
    const qs = new URLSearchParams(location.search);

    api
      .get("/bottles", {
        query: { q: qs.get("q") || "" },
      })
      .then((r) => setResults(r));
  }, [location.search]);

  const qs = new URLSearchParams(location.search);
  const [query, setQuery] = useState<string>(qs.get("q") || "");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <Box>
      <form method="GET" onSubmit={onSubmit}>
        <Box
          sx={{ display: "flex", alignItems: "flex-end", py: 4, width: "100%" }}
        >
          <AccountCircleIcon sx={{ color: "action.active", mr: 1, my: 0.5 }} />
          <TextField
            label="Search"
            variant="standard"
            name="q"
            sx={{ flex: 1 }}
            defaultValue={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
          />
        </Box>
      </form>
      {results.map((bottle) => {
        const title = (
          <>
            {bottle.name}
            {bottle.series && <em>{bottle.series}</em>}
          </>
        );
        return (
          <Card key={bottle.id}>
            <CardActionArea href={`/b/${bottle.id}/checkin`}>
              <CardHeader
                avatar={
                  <Avatar sx={{ bgcolor: red[500] }} aria-label="recipe">
                    L
                  </Avatar>
                }
                title={title}
                subheader={bottle.brand.name}
              />
            </CardActionArea>
          </Card>
        );
      })}
      {query && !results.length && (
        <Card>
          <CardActionArea href={`/addBottle`}>
            <CardHeader
              avatar={<AddIcon />}
              title="Can't find a bottle?"
              subheader={
                <span>
                  {`Tap here to add `}
                  <strong>{query}</strong>
                </span>
              }
            />
          </CardActionArea>
        </Card>
      )}
    </Box>
  );
}

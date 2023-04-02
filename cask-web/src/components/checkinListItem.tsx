import {
  Avatar,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  CardMedia,
  IconButton,
  Typography,
} from "@mui/material";
import type { Checkin } from "../types";
import { getBottleDisplayName } from "../lib";
import { red } from "@mui/material/colors";
import {
  Comment as CommentIcon,
  MoreVert as MoreVertIcon,
  SportsBar as SportsBarIcon,
} from "@mui/icons-material";

import Hibiki12Image from "../assets/hibiki-12.jpg";

export default function CheckinListItem({ value }: { value: Checkin }) {
  return (
    <Card sx={{ mb: 4 }} variant="outlined">
      <CardHeader
        avatar={
          <Avatar sx={{ bgcolor: red[500] }} aria-label="recipe">
            {value.user.displayName.substring(0, 1)}
          </Avatar>
        }
        action={
          <IconButton aria-label="settings">
            <MoreVertIcon />
          </IconButton>
        }
        title={value.user.displayName}
        subheader={value.location?.name}
      />
      <CardMedia height="194" component="img" image={Hibiki12Image}></CardMedia>
      <CardContent>
        <Typography gutterBottom variant="h5" component="div">
          {getBottleDisplayName(value.bottle)}
        </Typography>
        {!!value.tastingNotes && (
          <Typography variant="body2" color="text.secondary">
            {value.tastingNotes}
          </Typography>
        )}
      </CardContent>
      <CardActions disableSpacing>
        <Button aria-label="comment">
          <CommentIcon />
        </Button>
        <Button aria-label="cheers">
          <SportsBarIcon />
        </Button>
      </CardActions>
    </Card>
  );
}

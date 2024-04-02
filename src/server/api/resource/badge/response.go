package badge

import (
	"context"
	"peated/database/model"
	"strconv"
)

type Badge struct {
	ID     string                 `json:"id"`
	Type   model.BadgeType        `json:"type"`
	Name   string                 `json:"name"`
	Config map[string]interface{} `json:"config"`
}

type BadgeResponse struct {
	Badge *Badge `json:"badge"`
}

type BadgesResponse struct {
	Badges []*Badge `json:"badges"`
}

func NewBadgesResponse(ctx context.Context, us model.Badges) *BadgesResponse {
	badges := make([]*Badge, len(us))
	for i, v := range us {
		badges[i] = NewBadgeResponse(ctx, v).Badge
	}

	return &BadgesResponse{
		Badges: badges,
	}
}

func NewBadgeResponse(ctx context.Context, b *model.Badge) *BadgeResponse {
	return &BadgeResponse{
		Badge: &Badge{
			ID:   strconv.FormatUint(b.ID, 10),
			Type: b.Type,
			Name: b.Name,
			// Config: b.Config.MarshalJSON(),
		},
	}
}

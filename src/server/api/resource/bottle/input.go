package bottle

import (
	"peated/api/resource/common/schema"
	"peated/database/model"
)

type BottleInput struct {
	Name       string                         `json:"name" binding:"required"`
	Brand      interface{}                    `json:"brand" binding:"required"`
	Distillers schema.Optional[[]interface{}] `json:"distillers" binding:"dive"`
	Bottler    schema.Optional[interface{}]   `json:"bottler"`
	StatedAge  schema.Optional[uint]          `json:"statedAge" binding:"omitempty,numeric,gte=0,lte=100"`
	Category   schema.Optional[string]        `json:"category" binding:"omitempty,oneof:blend bourbon rye single_grain single_malt single_pot_still spirit"`
}

func (f *BottleInput) ToModel() *model.Bottle {
	return &model.Bottle{
		Name: f.Name,
	}
}

type ListInput struct {
	Sort   string `form:"sort,default=name"`
	Query  string `form:"query"`
	Cursor int    `form:"cursor,default=0" binding:"numeric,gte=0"`
	Limit  int    `form:"limit,default=100" binding:"numeric,lte=100"`
}

package bottle

import (
	"encoding/json"
	"peated/api/resource/common/schema"
	"peated/api/resource/entity"
	"peated/database/model"
)

type EntityOrID struct {
	ID     *uint64
	Entity *entity.EntityInput
}

func (v *EntityOrID) UnmarshalJSON(data []byte) error {
	{
		var value uint64
		if err := json.Unmarshal(data, &value); err == nil {
			v.ID = &value
			return nil
		}
	}
	var value entity.EntityInput
	err := json.Unmarshal(data, &value)
	if err == nil {
		v.Entity = &value
		return nil
	}

	return err
}

type BottleInput struct {
	Name       string                        `json:"name" binding:"required"`
	Brand      EntityOrID                    `json:"brand" binding:"required"`
	Distillers schema.Optional[[]EntityOrID] `json:"distillers"`
	Bottler    schema.Optional[EntityOrID]   `json:"bottler"`
	StatedAge  schema.Optional[uint64]       `json:"statedAge" binding:"omitempty,numeric,gte=0,lte=100"`
	Category   schema.Optional[string]       `json:"category" binding:"omitempty,oneof=blend bourbon rye single_grain single_malt single_pot_still spirit"`
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

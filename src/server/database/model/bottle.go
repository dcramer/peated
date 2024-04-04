package model

import (
	"time"

	"github.com/lib/pq"
	"gorm.io/datatypes"
)

const (
	CategorySingleMalt string = "single_malt"
)

type Bottle struct {
	ID        uint64 `gorm:"primaryKey" json:"id"`
	FullName  string `json:"full_name"`
	Name      string `json:"name"`
	Category  string `json:"category"`
	BrandID   uint64 `json:"brand_id"`
	BottlerID uint64 `json:"bottler_id"`
	StatedAge uint   `json:"stated_age"`

	Description   string         `json:"description"`
	TastingNotes  datatypes.JSON `json:"tasting_notes"`
	SuggestedTags pq.StringArray `json:"suggested_tags" gorm:"type:string[];default:[];not null"`

	AvgRating     float64 `json:"avg_rating"`
	TotalTastings uint    `json:"total_tastings"`

	CreatedAt   time.Time `json:"created_at"`
	CreatedByID uint64    `json:"created_by_id"`

	Brand      Entity
	Bottler    Entity
	Distillers []Entity `gorm:"many2many:bottle_distiller"`
	CreatedBy  User
}

func (Bottle) TableName() string {
	return "bottle"
}

type Bottles []*Bottle

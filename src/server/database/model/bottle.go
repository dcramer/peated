package model

import (
	"time"

	"github.com/lib/pq"
	"gorm.io/datatypes"
)

const (
	CategoryBlend          string = "blend"
	CategoryBourbon        string = "bourbon"
	CategoryRye            string = "rye"
	CategorySingleGrain    string = "single_grain"
	CategorySingleMalt     string = "single_malt"
	CategorySinglePotStill string = "single_pot_still"
	CategorySpirit         string = "spirit"
)

var CategoryNames = []string{
	CategoryBlend,
	CategoryBourbon,
	CategoryRye,
	CategorySingleGrain,
	CategorySingleMalt,
	CategorySinglePotStill,
	CategorySpirit,
}

type Bottle struct {
	ID        uint64  `gorm:"primaryKey" json:"id"`
	FullName  string  `json:"full_name" gorm:"not null"`
	Name      string  `json:"name" gorm:"not null"`
	Category  *string `json:"category"`
	BrandID   uint64  `json:"brand_id" gorm:"not null"`
	BottlerID *uint64 `json:"bottler_id"`
	StatedAge *uint   `json:"stated_age"`

	Description   *string         `json:"description"`
	TastingNotes  *datatypes.JSON `json:"tasting_notes"`
	SuggestedTags *pq.StringArray `json:"suggested_tags" gorm:"type:string[];default:[];not null"`

	AvgRating     *float64 `json:"avg_rating"`
	TotalTastings uint     `json:"total_tastings" gorm:"default:0;not null"`

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

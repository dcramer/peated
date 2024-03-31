package model

import (
	"peated/db/column"
	"time"

	"gorm.io/gorm"
)

type Category string

const (
	CategorySingleMalt Category = "single_malt"
)

type Bottle struct {
	gorm.Model
	ID        uint64   `gorm:"primaryKey" json:"id"`
	FullName  string   `json:"full_name"`
	Name      string   `json:"name"`
	Category  Category `json:"category"`
	BrandID   uint64   `json:"brand_id"`
	BottlerID uint64   `json:"bottler_id"`
	StatedAge uint     `json:"stated_age"`

	Description   string       `json:"description"`
	TastingNotes  column.JSONB `json:"tasting_notes"`
	SuggestedTags []string     `json:"suggested_tags"`

	AvgRating     float32 `json:"avg_rating"`
	TotalTastings uint    `json:"total_tastings"`

	CreatedAt   time.Time `json:"created_at"`
	CreatedByID uint64    `json:"created_by_id"`

	Brand      Entity
	Bottler    Entity
	Distillers []Entity `gorm:"many2many:bottle_distiller"`

	CreatedBy User
}

func (Bottle) TableName() string {
	return "bottle"
}

type Bottles []*Bottle

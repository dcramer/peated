package model

import (
	"peated/db/column"
	"time"

	"gorm.io/gorm"
)

type ChangeType string

const (
	ChangeTypeAdd    ChangeType = "add"
	ChangeTypeDelete ChangeType = "delete"
	ChangeTypeUpdate ChangeType = "update"
)

type ObjectType string

const (
	ObjectTypeBottle  ObjectType = "bottle"
	ObjectTypeComment ObjectType = "comment"
	ObjectTypeEntity  ObjectType = "entity"
	ObjectTypeTasting ObjectType = "tasting"
	ObjectTypeToast   ObjectType = "toast"
	ObjectTypeFollow  ObjectType = "follow"
)

type Change struct {
	gorm.Model
	ID          uint64       `gorm:"primaryKey" json:"id"`
	ObjectID    uint64       `json:"object_id"`
	ObjectType  ObjectType   `json:"object_type"`
	Type        ChangeType   `json:"type"`
	DisplayName string       `json:"display_name"`
	Data        column.JSONB `json:"data"`

	CreatedByID uint64    `json:"created_by_id"`
	CreatedAt   time.Time `json:"created_at"`

	CreatedBy User
}

func (Change) TableName() string {
	return "change"
}

type Changes []*Change

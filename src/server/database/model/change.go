package model

import (
	"time"

	"gorm.io/datatypes"
)

const (
	ChangeTypeAdd    string = "add"
	ChangeTypeDelete string = "delete"
	ChangeTypeUpdate string = "update"
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
	ID          uint64         `gorm:"primaryKey"`
	ObjectID    uint64         `gorm:"column:object_id;not null" json:"objectId"`
	ObjectType  ObjectType     `gorm:"column:object_type;not null" json:"objectType"`
	Type        string         `gorm:"column:type;not null"`
	DisplayName *string        `gorm:"column:display_name" json:"displayName"`
	Data        datatypes.JSON `gorm:"type:jsonb;not null"`

	CreatedByID uint64    `gorm:"column:created_by_id;not null" json:"createdById"`
	CreatedAt   time.Time `gorm:"column:created_at;not null" json:"createdAt"`

	CreatedBy User
}

func (Change) TableName() string {
	return "change"
}

type Changes []*Change

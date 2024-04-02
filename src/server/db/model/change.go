package model

import (
	"time"

	"gorm.io/datatypes"
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
	ID          uint64     `gorm:"primaryKey"`
	ObjectID    uint64     `gorm:"column:object_id" json:"objectId"`
	ObjectType  ObjectType `gorm:"column:object_type" json:"objectType"`
	Type        ChangeType
	DisplayName string         `gorm:"column:display_name" json:"displayName"`
	Data        datatypes.JSON `gorm:"type:jsonb"`

	CreatedByID uint64    `gorm:"column:creatd_by_id" json:"createdById"`
	CreatedAt   time.Time `gorm:"column:created_at" json:"createdAt"`

	CreatedBy User
}

func (Change) TableName() string {
	return "change"
}

type Changes []*Change

package model

import (
	"time"
)

type BadgeAward struct {
	ID        uint64    `gorm:"primaryKey" json:"id"`
	BadgeID   uint64    `json:"badge_id"`
	UserID    uint64    `json:"user_id"`
	Xp        uint      `json:"xp" default:"0"`
	Level     uint      `json:"level" default:"0"`
	CreatedAt time.Time `json:"created_at"`

	Badge Badge
	User  User
}

func (BadgeAward) TableName() string {
	return "badge_award"
}

type BadgeAwards []*BadgeAward

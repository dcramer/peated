package model

import (
	"time"

	"gorm.io/gorm"
)

type FollowStatus string

const (
	FollowStatusNone      FollowStatus = "none"
	FollowStatusPending   FollowStatus = "pending"
	FollowStatusFollowing FollowStatus = "following"
)

type Follow struct {
	gorm.Model
	ID         uint64       `gorm:"primaryKey" json:"id"`
	FromUserID uint64       `json:"from_user_id"`
	ToUserID   uint64       `json:"to_user_id"`
	Status     FollowStatus `json:"status"`

	CreatedAt time.Time `json:"created_at"`

	FromUser User
	ToUser   User
}

func (Follow) TableName() string {
	return "follow"
}

type Follows []*Follow

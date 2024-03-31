package model

import (
	"time"

	"gorm.io/gorm"
)

type NotificationType string

const (
	NotificationTypeComment       NotificationType = "comment"
	NotificationTypeToast         NotificationType = "toast"
	NotificationTypeFriendRequest NotificationType = "friend_request"
)

type Notification struct {
	gorm.Model
	ID         uint64           `gorm:"primaryKey" json:"id"`
	UserID     uint64           `json:"user_id"`
	FromUserID uint64           `json:"from_user_id"`
	ObjectID   uint64           `json:"object_id"`
	Type       NotificationType `json:"type"`

	CreatedByID uint64    `json:"created_by_id"`
	CreatedAt   time.Time `json:"created_at"`

	User     User
	FromUser User
}

func (Notification) TableName() string {
	return "notifications"
}

type Notifications []*Notification

package model

type EntityTombstone struct {
	EntityID    uint64 `gorm:"primaryKey;autoIncrement:false" json:"entity_id"`
	NewEntityID uint64 `gorm:"primaryKey;autoIncrement:false" json:"new_entity_id"`

	Entity    Entity
	NewEntity Entity
}

func (EntityTombstone) TableName() string {
	return "entity_tombstone"
}

type EntityTombstones []*EntityTombstone

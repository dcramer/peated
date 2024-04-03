package model

type BottleDistiller struct {
	BottleID    uint64 `json:"bottle_id" gorm:"primaryKey;autoincrement:false"`
	DistillerID uint64 `json:"distiller_id" gorm:"primaryKey;autoincrement:false"`

	Bottle Bottle
}

func (BottleDistiller) TableName() string {
	return "bottle_distiller"
}

type BottleDistillers []*BottleDistiller

package spatial

import (
	"bytes"
	"context"
	"database/sql/driver"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"strconv"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// future proof this using strings given they're fixed
// and we should probably be using decimal
func NewPoint(lng string, lat string) (*Point, error) {
	dLng, err := strconv.ParseFloat(lng, 64)
	if err != nil {
		return nil, err
	}
	dLat, err := strconv.ParseFloat(lat, 64)
	if err != nil {
		return nil, err
	}

	return &Point{
		Lng: dLng,
		Lat: dLat,
	}, nil
}

type Point struct {
	Lng float64 `json:"lng" binding:"longitude"`
	Lat float64 `json:"lat" binding:"latitude"`
}

func (p Point) GormDataType() string {
	return "geometry(point, 4326)"
}

func (p *Point) String() string {
	return fmt.Sprintf("SRID=4326;POINT(%v %v)", p.Lng, p.Lat)
}

func (p Point) GormValue(ctx context.Context, db *gorm.DB) clause.Expr {
	return clause.Expr{
		SQL:  "ST_PointFromText(?, 4326)",
		Vars: []interface{}{fmt.Sprintf("POINT(%v %v)", p.Lng, p.Lat)},
	}
}

func (p *Point) Scan(val interface{}) error {
	b, err := hex.DecodeString(string(val.(string)))
	if err != nil {
		return err
	}
	r := bytes.NewReader(b)
	var wkbByteOrder uint8
	if err := binary.Read(r, binary.LittleEndian, &wkbByteOrder); err != nil {
		return err
	}

	var byteOrder binary.ByteOrder
	switch wkbByteOrder {
	case 0:
		byteOrder = binary.BigEndian
	case 1:
		byteOrder = binary.LittleEndian
	default:
		return fmt.Errorf("invalid byte order %d", wkbByteOrder)
	}

	var wkbGeometryType uint64
	if err := binary.Read(r, byteOrder, &wkbGeometryType); err != nil {
		return err
	}

	if err := binary.Read(r, byteOrder, p); err != nil {
		return err
	}

	return nil
}

func (p Point) Value() (driver.Value, error) {
	return p.String(), nil
}

type NullPoint struct {
	Point Point
	Valid bool
}

func (np *NullPoint) Scan(val interface{}) error {
	if val == nil {
		np.Point, np.Valid = Point{}, false
		return nil
	}

	point := &Point{}
	err := point.Scan(val)
	if err != nil {
		np.Point, np.Valid = Point{}, false
		return nil
	}
	np.Point = Point{
		Lng: point.Lng,
		Lat: point.Lat,
	}
	np.Valid = true

	return nil
}

func (np NullPoint) Value() (driver.Value, error) {
	if !np.Valid {
		return nil, nil
	}
	return np.Point, nil
}

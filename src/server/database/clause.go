package database

import "gorm.io/gorm/clause"

type ILike clause.Eq

func (ilike ILike) Build(builder clause.Builder) {
	builder.WriteQuoted(ilike.Column)
	builder.WriteString(" ILIKE ")
	builder.AddVar(builder, ilike.Value)
}

func (ilike ILike) NegationBuild(builder clause.Builder) {
	builder.WriteQuoted(ilike.Column)
	builder.WriteString(" NOT ILIKE ")
	builder.AddVar(builder, ilike.Value)
}

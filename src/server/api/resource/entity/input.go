package entity

type EntityInput struct {
	Name string   `json:"name" binding:"required"`
	Type []string `json:"type" binding:"required"`
}

type ListInput struct {
	Sort   string `form:"sort,default=name"`
	Query  string `form:"query"`
	Cursor int    `form:"cursor,default=0" binding:"numeric,gte=0"`
	Limit  int    `form:"limit,default=100" binding:"numeric,lte=100"`
}

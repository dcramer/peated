package user

import "peated/api/resource/common/schema"

type UserInput struct {
	Username    string `json:"username" form:"required,max=255"`
	DisplayName string `json:"displayName" form:"max=255"`
	// admins only
	Private schema.Optional[bool] `json:"private"`
	Admin   schema.Optional[bool] `json:"admin"`
	Mod     schema.Optional[bool] `json:"mod"`
}

type ListInput struct {
	Query  string `form:"query"`
	Cursor int    `form:"cursor,default=0" binding:"numeric,gte=0"`
	Limit  int    `form:"limit,default=100" binding:"numeric,lte=100"`
}

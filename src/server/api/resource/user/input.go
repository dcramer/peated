package user

type UserInput struct {
	Username    string `json:"username" form:"required,max=255"`
	DisplayName string `json:"displayName" form:"max=255"`
	Private     bool   `json:"private"`
	Admin       bool   `json:"admin"`
	Mod         bool   `json:"mod"`
}

type FriendStatus string

const (
	FriendStatusNone      FriendStatus = "none"
	FriendStatusPending   FriendStatus = "pending"
	FriendStatusFollowing FriendStatus = "following"
)

type ListInput struct {
	Query  string `form:"query"`
	Cursor int    `form:"cursor,default=0" binding:"numeric,gte=0"`
	Limit  int    `form:"limit,default=100" binding:"numeric,lte=100"`
}

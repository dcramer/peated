package auth

type EmailPasswordInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type CodeInput struct {
	Code string `json:"code" binding:"required"`
}

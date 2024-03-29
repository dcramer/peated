package user

import (
	"peated/config"
)

func GetUser(id string) (User, error) {
	db := config.GetDB()
	sqlStatement := `SELECT * FROM users WHERE id = $1`
	var user User
	if err := db.QueryRow(sqlStatement, id).Scan(&user.ID, &user.Username, &user.Email); err != nil {
		return user, err
	}
	return user, nil
}

func CreateUser(user *User) (User, error) {
	db := config.GetDB()
	sqlStatement := `INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id`
	err := db.QueryRow(sqlStatement, user.Username, user.Email, user.PasswordHash).Scan(&user.ID)
	if err != nil {
		return *user, err
	}
	return *user, nil
}

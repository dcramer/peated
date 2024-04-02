package auth

import (
	"peated/config"
	"peated/database/model"
	"strconv"
	"strings"
	"time"

	"github.com/go-errors/errors"
	"github.com/golang-jwt/jwt"
	"gorm.io/gorm"
)

type UserClaims struct {
	ID string `json:"id"`
	jwt.StandardClaims
}

func VerifyToken(config *config.Config, tokenString string) (*UserClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(config.JwtSecret), nil
	})

	if err != nil {
		return nil, err
	}

	claims := token.Claims.(*UserClaims)

	return claims, nil
}

func GetUserFromHeader(config *config.Config, db *gorm.DB, header string) (*model.User, error) {
	token := strings.Split(header, "Bearer ")[1]

	if token == "" {
		return nil, errors.Errorf("no token")
	}

	claims, err := VerifyToken(config, token)
	if err != nil {
		return nil, errors.Join(errors.Errorf("unable to verify token"), err)
	}

	user := &model.User{}
	if err := db.Where("id = ?", claims.ID).First(&user).Error; err != nil {
		return nil, err
	}

	if !user.Active {
		return nil, errors.Errorf("inactive user")
	}

	return user, err
}

func CreateAccessToken(config *config.Config, user *model.User) (*string, error) {
	if user.ID == 0 {
		return nil, errors.Errorf("invalid user ID of 0")
	}

	claims := UserClaims{
		strconv.FormatUint(user.ID, 10),
		jwt.StandardClaims{
			// 30 days
			ExpiresAt: time.Now().Unix() + 2592000,
			Issuer:    "peated",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(config.JwtSecret))

	return &tokenString, err
}

//   export const createUser = async (
// 	db: DatabaseType | TransactionType,
// 	data: NewUser,
//   ): Promise<User> => {
// 	let user: User | undefined;
// 	let attempt = 0;
// 	const baseUsername = data.username.toLowerCase();
// 	let currentUsername = baseUsername;
// 	if (currentUsername === "me")
// 	  currentUsername = `${baseUsername}-${random(10000, 99999)}`;
// 	const maxAttempts = 5;
// 	while (!user && attempt < maxAttempts) {
// 	  attempt += 1;

// 	  try {
// 		user = await db.transaction(async (tx) => {
// 		  const [user] = await tx
// 			.insert(users)
// 			.values({
// 			  ...data,
// 			  username: currentUsername,
// 			})
// 			.returning();
// 		  return user;
// 		});
// 	  } catch (err: any) {
// 		if (err?.code === "23505" && err?.constraint === "user_username_unq") {
// 		  currentUsername = `${baseUsername}-${random(10000, 99999)}`;
// 		} else {
// 		  throw err;
// 		}
// 	  }
// 	}
// 	if (!user) throw new Error("Unable to create user");
// 	return user;
//   };

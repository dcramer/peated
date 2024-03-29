package auth

import (
	"peated/api/resource/user"
	"peated/config"
	"strings"

	"github.com/golang-jwt/jwt"
	"github.com/pkg/errors"
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
		return &UserClaims{}, err
	}

	claims := token.Claims.(*UserClaims)

	return claims, nil
}

func GetUserFromHeader(config *config.Config, db *gorm.DB, header string) (*user.User, error) {
	token := strings.Split(header, "Bearer ")[0]
	if token == "" {
		return &user.User{}, errors.Errorf("No token")
	}

	claims, err := VerifyToken(config, token)
	if err != nil {
		return &user.User{}, err
	}

	r := user.NewRepository(db)
	user, err := r.Read(claims.ID)
	if err != nil {
		return user, err
	}

	if !user.Active {
		return user, errors.Errorf("Inactive user")
	}

	return user, err
}

func CreateAccessToken(config *config.Config, db *gorm.DB, user *user.User) (string, error) {
	claims := UserClaims{
		user.ID,
		jwt.StandardClaims{
			ExpiresAt: 15000,
			Issuer:    "peated",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(config.JwtSecret)

	return tokenString, err
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

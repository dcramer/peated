package user_test

import (
	"context"
	"peated/api/resource/user"
	"peated/db/model"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/nrednav/cuid2"

	mockDB "peated/mock/db"
	testUtil "peated/util/test"
)

func TestRepository_List(t *testing.T) {
	t.Parallel()

	db, mock, err := mockDB.NewMockDB()
	testUtil.NoError(t, err)

	repo := user.NewRepository(db)

	mockRows := sqlmock.NewRows([]string{"id", "username", "email"}).
		AddRow(cuid2.Generate(), "foo", "foo@example.com").
		AddRow(cuid2.Generate(), "bar", "bar@example.com")

	mock.ExpectQuery("^SELECT (.+) FROM \"user\"").WillReturnRows(mockRows)

	ctx := context.Background()

	users, err := repo.List(ctx, &user.ListParams{})
	testUtil.NoError(t, err)
	testUtil.Equal(t, len(users), 2)
}

func TestRepository_Create(t *testing.T) {
	t.Parallel()

	db, mock, err := mockDB.NewMockDB()
	testUtil.NoError(t, err)

	repo := user.NewRepository(db)

	id := cuid2.Generate()
	mock.ExpectBegin()
	mock.ExpectExec("^INSERT INTO \"user\" ").
		WithArgs(id, "Username", "Email", "PasswordHash", "DisplayName", "PictureUrl", false, false, false, false, mockDB.AnyTime{}).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	user := &model.User{ID: id, Username: "Username", Email: "Email", PasswordHash: "PasswordHash", DisplayName: "DisplayName", PictureUrl: "PictureUrl", CreatedAt: time.Now()}
	_, err = repo.Create(user)
	testUtil.NoError(t, err)
}

func TestRepository_Read(t *testing.T) {
	t.Parallel()

	db, mock, err := mockDB.NewMockDB()
	testUtil.NoError(t, err)

	repo := user.NewRepository(db)

	id := cuid2.Generate()
	mockRows := sqlmock.NewRows([]string{"id", "username", "email", "display_name"}).
		AddRow(id, "foo", "foo@example.com", "Foo Bar")

	mock.ExpectQuery("^SELECT (.+) FROM \"user\" WHERE (.+) LIMIT (.+)").
		WithArgs(id, 1).
		WillReturnRows(mockRows)

	user, err := repo.Read(id)
	testUtil.NoError(t, err)
	testUtil.Equal(t, "Foo Bar", user.DisplayName)
}

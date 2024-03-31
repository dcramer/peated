package user_test

import (
	"context"
	"fmt"
	"log"
	"os"
	"path"
	"peated/api/resource/user"
	"runtime"
	"testing"

	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"gorm.io/gorm"

	"peated/test"
)

var ctx context.Context
var container *postgres.PostgresContainer

func TestMain(m *testing.M) {
	var err error

	ctx = context.Background()

	// TODO: how do we improve this
	_, filename, _, _ := runtime.Caller(0)
	dir := path.Join(path.Dir(filename), "..", "..", "..")
	fmt.Printf("dir %s", dir)
	err = os.Chdir(dir)
	if err != nil {
		panic(err)
	}

	container, err = test.SetupContainer(ctx)
	if err != nil {
		panic(err)
	}

	defer func() {
		if err := container.Terminate(ctx); err != nil {
			log.Fatalf("failed to terminate container: %s", err)
		}
	}()

	os.Exit(m.Run())
}

func TestRepository_List(t *testing.T) {
	t.Parallel()

	db, err := test.InitDatabase(ctx, container)

	test.NoError(t, err)

	err = db.Transaction(func(tx *gorm.DB) error {
		repo := user.NewRepository(tx)

		users, err := repo.List(ctx, &user.ListParams{})
		test.NoError(t, err)
		test.Equal(t, len(users), 0)

		return err
	})
	test.NoError(t, err)

}

func TestRepository_ReadById(t *testing.T) {
	t.Parallel()

	db, err := test.InitDatabase(ctx, container)

	test.NoError(t, err)

	err = db.Transaction(func(tx *gorm.DB) error {
		repo := user.NewRepository(tx)

		user, err := repo.ReadById(ctx, 1)
		test.NoError(t, err)
		test.Equal(t, "Foo Bar", user.DisplayName)

		return nil
	})
	test.NoError(t, err)
}

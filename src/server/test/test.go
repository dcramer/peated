package test

import "peated/config"

func NewConfig() *config.Config {
	config := &config.Config{
		Debug:     true,
		JwtSecret: "test-jwt-secret",
		Port:      4000,

		Database: config.ConfigDB{
			Host:     "localhost",
			Port:     5432,
			Username: "postgres",
			Password: "postgres",
			Name:     "test_peated",
		},

		Google: config.ConfigGoogle{
			ClientID:     "google-client-id",
			ClientSecret: "google-client-secret",
		},
	}

	return config
}

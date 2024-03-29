package config

import (
	"log"

	"github.com/joeshaw/envdecode"
)

type Config struct {
	Debug    bool `env:"DEBUG,default=false"`
	Port     int  `env:"PORT,default=4000"`
	Database ConfigDB
}

type ConfigDB struct {
	Host     string `env:"DB_HOST,default=localhost"`
	Port     int    `env:"DB_PORT,default=5432"`
	Username string `env:"DB_USER,default=postgres"`
	Password string `env:"DB_PASS,default=postgres"`
	Name     string `env:"DB_NAME,default=peated"`
}

func New() *Config {
	var c Config
	if err := envdecode.StrictDecode(&c); err != nil {
		log.Fatalf("Failed to decode: %s", err)
	}

	return &c
}

func NewDB() *ConfigDB {
	var c ConfigDB
	if err := envdecode.StrictDecode(&c); err != nil {
		log.Fatalf("Failed to decode: %s", err)
	}

	return &c
}

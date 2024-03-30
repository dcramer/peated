package config

import (
	"log"

	"github.com/joeshaw/envdecode"
	"github.com/joho/godotenv"
)

type Config struct {
	Debug     bool   `env:"DEBUG,default=false"`
	Port      int    `env:"PORT,default=4000"`
	JwtSecret string `env:"JWT_SECRET"`
	Version   string `envv:"VERSION"`
	Database  ConfigDB
	Google    ConfigGoogle
}

type ConfigDB struct {
	Host     string `env:"DB_HOST,default=localhost"`
	Port     int    `env:"DB_PORT,default=5432"`
	Username string `env:"DB_USER,default=postgres"`
	Password string `env:"DB_PASS,default=postgres"`
	Name     string `env:"DB_NAME,default=peated"`
}

type ConfigGoogle struct {
	ClientID     string `env:"GOOGLE_CLIENT_ID"`
	ClientSecret string `env:"GOOGLE_CLIENT_SECRET"`
}

func New() *Config {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

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

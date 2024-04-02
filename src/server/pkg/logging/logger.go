package logging

import (
	"os"
	"sync"

	"github.com/rs/zerolog"
)

var (
	// defaultLogger is the default logger. It is initialized once per package
	// include upon calling DefaultLogger.
	defaultLogger     *zerolog.Logger
	defaultLoggerOnce sync.Once
)

func NewLogger(isDebug bool) *zerolog.Logger {
	logLevel := zerolog.InfoLevel
	if isDebug {
		logLevel = zerolog.TraceLevel
	}

	zerolog.SetGlobalLevel(logLevel)
	logger := zerolog.New(os.Stdout).With().Timestamp().Logger()

	return &logger
}

func DefaultLogger() *zerolog.Logger {
	defaultLoggerOnce.Do(func() {
		defaultLogger = NewLogger(false)
	})
	return defaultLogger
}

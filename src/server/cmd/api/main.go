package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"peated/api/router"
	"peated/config"
	"peated/db"
	"peated/util/logger"
	"sync"
	"time"
)

// https://grafana.com/blog/2024/02/09/how-i-write-http-services-in-go-after-13-years/
func run(ctx context.Context, _, stderr io.Writer, _ []string) error {
	ctx, cancel := signal.NotifyContext(ctx, os.Interrupt)
	defer cancel()

	config := config.New()
	logger := logger.New(config.Debug)

	db, err := db.Init(ctx, config)
	if err != nil {
		return err
	}

	router := router.New(
		logger,
		config,
		db,
	)
	httpServer := &http.Server{
		Addr:    net.JoinHostPort("localhost", fmt.Sprint(config.Port)),
		Handler: router,
	}
	go func() {
		log.Printf("listening on %s\n", httpServer.Addr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Fprintf(stderr, "error listening and serving: %s\n", err)
		}
	}()
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		<-ctx.Done()
		// make a new context for the Shutdown (thanks Alessandro Rosetti)
		shutdownCtx := context.Background()
		shutdownCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			fmt.Fprintf(stderr, "error shutting down http server: %s\n", err)
		}
	}()
	wg.Wait()
	return nil
}

func main() {
	ctx := context.Background()
	if err := run(ctx, os.Stdout, os.Stderr, os.Args); err != nil {
		fmt.Fprintf(os.Stderr, "%s\n", err)
		os.Exit(1)
	}
}

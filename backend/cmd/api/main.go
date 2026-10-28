package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/bayesmarket/bayesmarket/internal/config"
	"github.com/bayesmarket/bayesmarket/internal/database"
	"github.com/bayesmarket/bayesmarket/internal/transport/rest"
	"github.com/bayesmarket/bayesmarket/internal/transport/ws"
	"github.com/gin-gonic/gin"
)

func main() {
	migrateOnly := flag.Bool("migrate", false, "Run pending database migrations, then exit")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[FATAL] Configuration error: %v\n", err)
	}

	if !cfg.IsDevOrLocal() {
		gin.SetMode(gin.ReleaseMode)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	if cfg.ServerPort != "" {
		port = cfg.ServerPort
	}

	// The server never runs without its database: every endpoint reads or writes money.
	if cfg.DatabaseURL == "" {
		log.Fatal("[FATAL] DATABASE_URL is required")
	}
	migrationURL := cfg.MigrationDatabaseURL
	if migrationURL == "" {
		migrationURL = cfg.DatabaseURL
	}

	// 1. Handle dedicated CLI tasks (-migrate flag)
	if *migrateOnly {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		migPool, err := database.NewPool(ctx, migrationURL)
		if err != nil {
			log.Fatalf("[FATAL] Failed to connect for migration: %v\n", err)
		}
		defer migPool.Close()

		log.Println("[INFO] Checking and applying database migrations...")
		if err := database.RunMigrations(ctx, migPool); err != nil {
			log.Fatalf("[FATAL] Database migration failed: %v\n", err)
		}

		log.Println("[INFO] Migrations completed successfully.")
		return
	}

	// 2. Apply migrations before serving, through the privileged URL when one is configured
	if cfg.AutoMigrate {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		migPool, err := database.NewPool(ctx, migrationURL)
		if err != nil {
			cancel()
			log.Fatalf("[FATAL] Failed to connect for migrations: %v\n", err)
		}
		log.Println("[INFO] Applying database migrations...")
		err = database.RunMigrations(ctx, migPool)
		migPool.Close()
		cancel()
		if err != nil {
			log.Fatalf("[FATAL] Database migration failed: %v\n", err)
		}
		log.Println("[INFO] Database migrations applied successfully.")
	} else {
		log.Println("[INFO] Auto-migrations disabled (AUTO_MIGRATE=false). Operating with runtime database user permissions.")
	}

	// 3. Initialize runtime connection pool (least-privilege DATABASE_URL). Failure is fatal.
	dbCtx, dbCancel := context.WithTimeout(context.Background(), 45*time.Second)
	dbPool, err := database.NewPool(dbCtx, cfg.DatabaseURL)
	dbCancel()
	if err != nil {
		log.Fatalf("[FATAL] Could not connect to PostgreSQL: %v\n", err)
	}
	defer dbPool.Close()

	// Initialize real-time WebSocket broker hub
	wsHub := ws.NewHub()
	go wsHub.Run()

	router := rest.SetupRouter(dbPool, cfg, wsHub)

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("[INFO] BayesMarket API server listening on :%s\n", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] Server listen error: %v\n", err)
		}
	}()

	// Graceful shutdown listener
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[INFO] Shutting down server gracefully...")
	wsHub.Stop()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("[FATAL] Server forced to shutdown: %v\n", err)
	}

	log.Println("[INFO] Server exited successfully.")
}

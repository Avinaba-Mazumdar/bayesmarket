package main

import (
	"context"
	"flag"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Avinaba-Mazumdar/bayesmarket/internal/config"
	"github.com/Avinaba-Mazumdar/bayesmarket/internal/database"
	"github.com/Avinaba-Mazumdar/bayesmarket/internal/transport/rest"
	"github.com/Avinaba-Mazumdar/bayesmarket/internal/transport/ws"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	startedAt := time.Now()
	migrateOnly := flag.Bool("migrate", false, "Run pending database migrations, then exit")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[FATAL] Configuration error: %v\n", err)
	}

	if !cfg.IsDevOrLocal() {
		gin.SetMode(gin.ReleaseMode)
	}

	port := cfg.ServerPort
	if port == "" {
		port = "8080"
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

	// 2. Open the pools without waiting for the database. pgx starts dialing in the background, so a
	// suspended Neon compute begins waking while the port opens below.
	dbPool, err := database.OpenPool(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("[FATAL] Could not configure PostgreSQL pool: %v\n", err)
	}
	defer dbPool.Close()

	// The privileged pool exists only when MIGRATION_DATABASE_URL differs; otherwise migrations and
	// retention share the runtime pool instead of dialing the same database twice.
	var privileged *pgxpool.Pool
	if migrationURL != cfg.DatabaseURL {
		privileged, err = database.OpenPool(migrationURL)
		if err != nil {
			log.Fatalf("[FATAL] Could not configure MIGRATION_DATABASE_URL pool: %v\n", err)
		}
		defer privileged.Close()
	}
	adminPool := dbPool
	if privileged != nil {
		adminPool = privileged
	}

	// Initialize real-time WebSocket broker hub
	wsHub := ws.NewHub()
	go wsHub.Run()

	// 3. Serve at once. /api answers 503 with Retry-After until the database is ready.
	readiness := rest.NewReadiness()
	router := rest.SetupRouterWithReadiness(dbPool, cfg, wsHub, readiness)

	srv := &http.Server{
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("[FATAL] Server listen error: %v\n", err)
	}
	go func() {
		if err := srv.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] Server listen error: %v\n", err)
		}
	}()
	log.Printf("[INFO] BayesMarket API server listening on :%s (%s after start)\n", port, time.Since(startedAt).Round(time.Millisecond))

	// 4. Connect, migrate, then open the gate. A database that never answers ends the process, as before.
	retentionCtx, stopRetention := context.WithCancel(context.Background())
	defer stopRetention()
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		if err := database.WaitReady(ctx, dbPool); err != nil {
			log.Fatalf("[FATAL] Could not connect to PostgreSQL: %v\n", err)
		}
		if privileged != nil {
			if err := database.WaitReady(ctx, privileged); err != nil {
				log.Fatalf("[FATAL] Could not connect with MIGRATION_DATABASE_URL: %v\n", err)
			}
		}
		log.Printf("[INFO] Database ready (%s after start)\n", time.Since(startedAt).Round(time.Millisecond))

		if cfg.AutoMigrate {
			log.Println("[INFO] Applying database migrations...")
			if err := database.RunMigrations(ctx, adminPool); err != nil {
				log.Fatalf("[FATAL] Database migration failed: %v\n", err)
			}
			log.Printf("[INFO] Database migrations applied (%s after start)\n", time.Since(startedAt).Round(time.Millisecond))
		} else {
			log.Println("[INFO] Auto-migrations disabled (AUTO_MIGRATE=false). Operating with runtime database user permissions.")
		}

		readiness.MarkReady()
		log.Printf("[INFO] Accepting API traffic (%s after start)\n", time.Since(startedAt).Round(time.Millisecond))
		database.StartRetention(retentionCtx, adminPool)
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

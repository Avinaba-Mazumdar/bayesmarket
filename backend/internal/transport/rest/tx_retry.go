package rest

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

// AppError represents a domain or business validation error with an HTTP status code.
type AppError struct {
	StatusCode int
	ErrorCode  string
	Message    string
}

func (e *AppError) Error() string {
	return e.Message
}

// IsSerializationOrDeadlock checks if a pgx error is a transient PostgreSQL concurrency error:
// - 40001: serialization_failure
// - 40P01: deadlock_detected
// - 55P03: lock_not_available
func IsSerializationOrDeadlock(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "40001" || pgErr.Code == "40P01" || pgErr.Code == "55P03"
	}
	return false
}

// IsUniqueViolation reports whether err is a PostgreSQL unique_violation (23505), e.g. a
// concurrent request that already stored the same idempotency key.
func IsUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// ExecuteSerializableWithRetry runs a transactional closure with automatic exponential-backoff retries
// for PostgreSQL transient concurrency conflicts. Business errors and idempotency conflicts terminate immediately.
func ExecuteSerializableWithRetry[T any](
	ctx context.Context,
	maxRetries int,
	fn func() (*T, error),
) (*T, error) {
	var lastErr error
	for attempt := 0; attempt < maxRetries; attempt++ {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		res, err := fn()
		if err == nil {
			return res, nil
		}

		lastErr = err

		// Fast abort on idempotency collisions or domain AppErrors
		if errors.Is(err, ErrIdempotencyReplay) {
			return nil, err
		}

		var appErr *AppError
		if errors.As(err, &appErr) {
			return nil, appErr
		}

		// Check if it is a retryable PostgreSQL concurrency conflict
		if IsSerializationOrDeadlock(err) {
			sleepDuration := time.Duration(20*(attempt+1)) * time.Millisecond
			select {
			case <-time.After(sleepDuration):
			case <-ctx.Done():
				return nil, ctx.Err()
			}
			continue
		}

		// Non-retryable error
		return nil, err
	}

	return nil, lastErr
}

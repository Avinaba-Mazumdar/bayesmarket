package rest

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	// ErrIdempotencyReplay signals that a concurrent request already stored this key; the caller
	// should return the stored receipt.
	ErrIdempotencyReplay = errors.New("idempotency_replay")
	// ErrIdempotencyKeyReused signals that the key was used before for a different request body.
	ErrIdempotencyKeyReused = errors.New("idempotency_key_reused")
)

// idempotencyConstraintName is the unique constraint on trades that a concurrent duplicate hits.
const idempotencyConstraintName = "uq_trades_user_idempotency_type"

// idempotencyKeyMaxLen matches the VARCHAR(128) column.
const idempotencyKeyMaxLen = 128

// validateIdempotencyKey rejects keys that the column cannot store or that contain characters
// outside printable ASCII (no spaces, no control characters).
func validateIdempotencyKey(key string) *AppError {
	if key == "" || len(key) > idempotencyKeyMaxLen {
		return &AppError{
			StatusCode: http.StatusBadRequest,
			ErrorCode:  "invalid_idempotency_key",
			Message:    "Idempotency-Key must be 1 to 128 characters",
		}
	}
	for i := 0; i < len(key); i++ {
		if key[i] < 0x21 || key[i] > 0x7e {
			return &AppError{
				StatusCode: http.StatusBadRequest,
				ErrorCode:  "invalid_idempotency_key",
				Message:    "Idempotency-Key may only contain printable ASCII characters without spaces",
			}
		}
	}
	return nil
}

// requestFingerprint is a SHA-256 over the fields that define a request. A stored receipt is replayed
// only when the fingerprint of the retry matches, so one key cannot silently return the receipt of a
// different order.
func requestFingerprint(parts ...string) string {
	sum := sha256.Sum256([]byte(strings.Join(parts, "\x1f")))
	return hex.EncodeToString(sum[:])
}

// GetCachedIdempotencyResponse returns the stored receipt for this actor, operation and key. It returns
// ErrIdempotencyKeyReused when the key exists for a request with a different fingerprint. Receipts
// written before fingerprints existed carry no fingerprint and are replayed as before.
func GetCachedIdempotencyResponse(
	ctx context.Context,
	pool *pgxpool.Pool,
	actorID uuid.UUID,
	operation string,
	idempotencyKey string,
	fingerprint string,
) ([]byte, bool, error) {
	query := `
		SELECT response, request_hash
		FROM idempotency_keys
		WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3;
	`
	var cached []byte
	var storedHash *string
	err := pool.QueryRow(ctx, query, actorID, operation, idempotencyKey).Scan(&cached, &storedHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, false, nil
		}
		return nil, false, err
	}
	if storedHash != nil && *storedHash != fingerprint {
		return nil, false, ErrIdempotencyKeyReused
	}
	if len(cached) > 0 {
		return cached, true, nil
	}
	return nil, false, nil
}

// writeIdempotencyReceipt stores a receipt in the given transaction. A conflicting row written by a
// concurrent request is left in place; the caller's transaction then sees the replay on commit.
func writeIdempotencyReceipt(ctx context.Context, tx pgx.Tx, actorID uuid.UUID, operation, idempotencyKey, fingerprint string, response []byte) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO idempotency_keys (actor_id, operation, idempotency_key, response, request_hash, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (actor_id, operation, idempotency_key) DO NOTHING;
	`, actorID, operation, idempotencyKey, response, fingerprint)
	return err
}

// QueueIdempotencyRecord queues the idempotency key receipt insertion into a pgx batch.
func QueueIdempotencyRecord(
	batch *pgx.Batch,
	actorID uuid.UUID,
	operation string,
	idempotencyKey string,
	fingerprint string,
	responseBytes []byte,
) {
	if len(responseBytes) == 0 {
		return
	}
	query := `
		INSERT INTO idempotency_keys (actor_id, operation, idempotency_key, response, request_hash, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (actor_id, operation, idempotency_key) DO NOTHING;
	`
	batch.Queue(query, actorID, operation, idempotencyKey, responseBytes, fingerprint)
}

// IsIdempotencyReplayError checks if a database error corresponds to an idempotency unique constraint collision.
func IsIdempotencyReplayError(err error) bool {
	if errors.Is(err, ErrIdempotencyReplay) {
		return true
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.ConstraintName == idempotencyConstraintName {
		return true
	}
	return false
}

// idempotencyReusedError is the response for a key reused with a different request body.
func idempotencyReusedError() *AppError {
	return &AppError{
		StatusCode: http.StatusUnprocessableEntity,
		ErrorCode:  "idempotency_key_reused",
		Message:    "This Idempotency-Key was already used for a different request. Use a new key for a new request.",
	}
}

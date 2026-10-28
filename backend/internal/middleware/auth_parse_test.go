package middleware

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func TestParseAccessToken_RejectsNoneAlgorithmMissingExpiryAndWrongIssuer(t *testing.T) {
	const secret = "test-secret-at-least-thirty-two-characters"
	userID := uuid.New().String()

	signed, err := SignAccessToken(secret, userID, false)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ParseAccessToken(signed, secret); err != nil {
		t.Fatal(err)
	}

	none := jwt.NewWithClaims(jwt.SigningMethodNone, AuthClaims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    AccessTokenIssuer,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	})
	unsigned, err := none.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ParseAccessToken(unsigned, secret); err == nil {
		t.Fatal("expected alg=none to be rejected")
	}

	noExp := jwt.NewWithClaims(jwt.SigningMethodHS256, AuthClaims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer: AccessTokenIssuer,
		},
	})
	noExpSigned, err := noExp.SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ParseAccessToken(noExpSigned, secret); err == nil {
		t.Fatal("expected a token without expiry to be rejected")
	}

	wrongIss := jwt.NewWithClaims(jwt.SigningMethodHS256, AuthClaims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "someone-else",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	})
	wrongSigned, err := wrongIss.SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ParseAccessToken(wrongSigned, secret); err == nil {
		t.Fatal("expected the wrong issuer to be rejected")
	}
}

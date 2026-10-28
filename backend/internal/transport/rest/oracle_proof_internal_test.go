package rest

import "testing"

func TestValidateOracleProof(t *testing.T) {
	for _, ok := range []string{"https://www.bls.gov/news.release/empsit.nr0.htm", "https://example.com/a?b=c"} {
		if err := validateOracleProof(ok); err != nil {
			t.Errorf("%q should be accepted: %v", ok, err)
		}
	}
	for _, bad := range []string{"", "test", "Official source", "http://example.com/x", "javascript:alert(1)", "https://", "https://exa mple.com", "ftp://example.com/x"} {
		if err := validateOracleProof(bad); err == nil || err.ErrorCode != "invalid_proof" {
			t.Errorf("%q should be rejected with invalid_proof", bad)
		}
	}
}

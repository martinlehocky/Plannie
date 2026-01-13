package main

import (
	"database/sql"
	"fmt"
	"net/smtp"
	"os"
	"strconv"
	"time"

	"github.com/google/uuid"
)

// sendEmailSMTP sends a plain HTML email via SMTP.
// Required ENV: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
func sendEmailSMTP(to, subject, htmlBody string) error {
	host := os.Getenv("SMTP_HOST")
	portStr := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := os.Getenv("SMTP_PASS")
	from := os.Getenv("EMAIL_FROM")
	if host == "" || portStr == "" || from == "" {
		return fmt.Errorf("SMTP not configured")
	}
	port, _ := strconv.Atoi(portStr)
	auth := smtp.PlainAuth("", user, pass, host)

	msg := "MIME-Version: 1.0\r\n" +
		"Content-Type: text/html; charset=\"utf-8\"\r\n" +
		fmt.Sprintf("From: %s\r\n", from) +
		fmt.Sprintf("To: %s\r\n", to) +
		fmt.Sprintf("Subject: %s\r\n\r\n", subject) +
		htmlBody

	addr := fmt.Sprintf("%s:%d", host, port)
	return smtp.SendMail(addr, auth, from, []string{to}, []byte(msg))
}

// createEmailToken creates a new token row in email_tokens and returns the raw token and token ID.
// rawToken is the raw secret that you send to the user; tokenID is the DB key used for lookup.
func createEmailToken(userID, kind string, ttl time.Duration) (rawToken, tokenID string, err error) {
	raw := uuid.NewString()
	tokenID = uuid.NewString()
	expires := time.Now().UTC().Add(ttl)

	hashed, err := hashToken(raw)
	if err != nil {
		return "", "", err
	}

	_, err = db.Exec(`INSERT INTO email_tokens(id, user_id, kind, token_hash, expires_at, created_at, used) VALUES (?,?,?,?,?,?,0)`,
		tokenID, userID, kind, hashed, expires, time.Now().UTC())
	if err != nil {
		return "", "", err
	}
	return raw, tokenID, nil
}

// verifyEmailTokenByID looks up tokenID and verifies the provided raw token against the stored hash.
// It also checks kind and expiry. If successful, it marks token used and returns the userID.
func verifyEmailTokenByID(tokenID, rawToken, kind string) (userID string, err error) {
	var id, uid, thash string
	var expires time.Time
	var used int
	err = db.QueryRow(`SELECT id, user_id, token_hash, expires_at, used FROM email_tokens WHERE id = ? AND kind = ?`, tokenID, kind).
		Scan(&id, &uid, &thash, &expires, &used)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("invalid token")
	} else if err != nil {
		return "", err
	}
	if used == 1 || time.Now().After(expires) {
		return "", fmt.Errorf("expired or used")
	}
	if err := verifyTokenHash(thash, rawToken); err != nil {
		return "", fmt.Errorf("invalid token")
	}
	if _, err := db.Exec(`UPDATE email_tokens SET used = 1 WHERE id = ?`, id); err != nil {
		// non-fatal; log in server log
	}
	return uid, nil
}
package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/smtp"
	"os"
	"os/signal"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/time/rate"
)

/*
Security & Architecture Notes (updated)
- Added email verification & password reset tokens (email_tokens table).
- Users table now has email + email_verified.
- Email token hashing re-uses sha256+bcrypt pattern to avoid exposing raw tokens.
- Token links include tokenID and raw token.
- On password reset we revoke refresh tokens for that user.
*/

var (
	db        *sql.DB
	jwtSecret []byte
)

const (
	accessTTL         = 15 * time.Minute
	refreshTTL        = 30 * 24 * time.Hour // long-lived (remember me)
	refreshTTLShort   = 24 * time.Hour      // shorter when rememberMe=false
	lockoutThreshold  = 5
	lockoutWindow     = 15 * time.Minute
	schemaVersion     = 2
	refreshCookieName = "rt"
)

var (
	reqTimeout       = 5 * time.Second // override via REQUEST_TIMEOUT_MS
	cookieSecure     = true            // override via COOKIE_SECURE=false for local HTTP
	brevoAPIKey      string
	brevoSenderEmail string
	brevoSenderName  string
	resetCodeTTL     = 15 * time.Minute
)

// SSE broadcaster (unchanged)
type subscriber struct{ ch chan []byte }

var (
	sseMu        sync.Mutex
	sseSubs      = make(map[string]map[*subscriber]struct{}) // eventID -> subs
	ssePingEvery = 30 * time.Second
)

func sseSubscribe(eventID string) *subscriber {
	sseMu.Lock()
	defer sseMu.Unlock()
	sub := &subscriber{ch: make(chan []byte, 8)}
	if sseSubs[eventID] == nil {
		sseSubs[eventID] = make(map[*subscriber]struct{})
	}
	sseSubs[eventID][sub] = struct{}{}
	return sub
}

func sseUnsubscribe(eventID string, sub *subscriber) {
	sseMu.Lock()
	defer sseMu.Unlock()
	if m, ok := sseSubs[eventID]; ok {
		if _, ok := m[sub]; ok {
			delete(m, sub)
			close(sub.ch)
		}
		if len(m) == 0 {
			delete(sseSubs, eventID)
		}
	}
}

func ssePublish(eventID string, payload []byte) {
	sseMu.Lock()
	defer sseMu.Unlock()
	for sub := range sseSubs[eventID] {
		select {
		case sub.ch <- payload:
		default:
			delete(sseSubs[eventID], sub)
			close(sub.ch)
		}
	}
}

type Claims struct {
	UserID string `json:"uid"`
	jwt.RegisteredClaims
}

// DB models
type User struct {
	ID            string    `json:"id"`
	Username      string    `json:"username"`
	Email         string    `json:"email"`
	EmailVerified bool      `json:"email_verified"`
	PasswordHash  string    `json:"-"` // ensure never serialized
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Event struct {
	ID            string
	CreatorID     string
	Name          string
	DateFrom      string
	DateTo        string
	Duration      float64
	Timezone      string
	DisabledSlots string // JSON
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type Participant struct {
	ID           string
	EventID      string
	UserID       string
	Availability string // JSON
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type RefreshToken struct {
	ID        string
	UserID    string
	FamilyID  string
	Version   int
	TokenHash string
	ExpiresAt time.Time
	CreatedAt time.Time
	Revoked   bool
}

// Payload for event update (API compatibility)
type EventUpdate struct {
	ID            string                   `json:"id"`
	Name          string                   `json:"name"`
	DateRange     map[string]string        `json:"dateRange"`
	Duration      float64                  `json:"duration"`
	Timezone      string                   `json:"timezone"`
	Participants  []map[string]interface{} `json:"participants"`
	DisabledSlots []string                 `json:"disabledSlots,omitempty"`
}

// Validation
var (
	usernameRe = regexp.MustCompile(`^[a-zA-Z0-9]{3,30}$`)
	passDigit  = regexp.MustCompile(`[0-9]`)
	passSpec   = regexp.MustCompile(`[!@#\$%\^&\*\(\)\-\_\+\=\{\}\[\]:;\"'<>,\\.\?/\\\|]`)
	emailRe    = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
)

func validateUsername(u string) bool { return usernameRe.MatchString(u) }
func validatePassword(p string) bool {
	if len(p) < 8 {
		return false
	}
	return passDigit.MatchString(p) && passSpec.MatchString(p)
}
func validateEmail(e string) bool { return e != "" && emailRe.MatchString(e) }

// hashToken and verifyTokenHash avoid bcrypt 72-byte limit by hashing first
func hashToken(token string) (string, error) {
	sum := sha256.Sum256([]byte(token))
	b, err := bcrypt.GenerateFromPassword([]byte(hex.EncodeToString(sum[:])), 12)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func verifyTokenHash(hash string, token string) error {
	sum := sha256.Sum256([]byte(token))
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(hex.EncodeToString(sum[:])))
}

// Email helpers (SMTP + token)
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

// createEmailToken creates a token row in email_tokens and returns (rawToken, tokenID).
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

// verifyEmailTokenByID verifies tokenID/rawToken/kind, marks used, returns userID.
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
		// non-fatal
	}
	return uid, nil
}

// Brevo email helper (transactional API)
type brevoEmailReq struct {
	Sender      map[string]string   `json:"sender"`
	To          []map[string]string `json:"to"`
	Subject     string              `json:"subject"`
	HTMLContent string              `json:"htmlContent"`
}

func sendEmailBrevo(toEmail, subject, html string) error {
	if brevoAPIKey == "" || brevoSenderEmail == "" {
		return errors.New("brevo not configured")
	}
	payload := brevoEmailReq{
		Sender: map[string]string{
			"email": brevoSenderEmail,
			"name":  brevoSenderName,
		},
		To: []map[string]string{{
			"email": toEmail,
			"name":  toEmail, // fallback to satisfy Brevo requirement
		}},
		Subject:     subject,
		HTMLContent: html,
	}
	b, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "https://api.brevo.com/v3/smtp/email", bytes.NewReader(b))
	req.Header.Set("api-key", brevoAPIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("brevo send failed: %s", string(body))
	}
	return nil
}

// JWT helpers
func signAccessToken(userID string) (string, error) {
	claims := &Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(accessTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(jwtSecret)
}

func signRefreshToken(userID, family string, version int, expiresAt time.Time) (string, string, error) {
	rc := jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(expiresAt),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		Subject:   userID,
		ID:        fmt.Sprintf("%s:%d", family, version),
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, rc)
	signed, err := t.SignedString(jwtSecret)
	return signed, rc.ID, err
}

func parseAccessToken(tok string) (*Claims, error) {
	parsed, err := jwt.ParseWithClaims(tok, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := parsed.Claims.(*Claims); ok && parsed.Valid {
		return claims, nil
	}
	return nil, errors.New("invalid token")
}

// DB open & migration (updated to include email + email_tokens)
func openDB(path string) (*sql.DB, error) {
	d, err := sql.Open("sqlite3", fmt.Sprintf("file:%s?_foreign_keys=on&_journal_mode=WAL", path))
	if err != nil {
		return nil, err
	}
	d.SetMaxOpenConns(25)
	d.SetMaxIdleConns(25)
	d.SetConnMaxIdleTime(5 * time.Minute)
	d.SetConnMaxLifetime(60 * time.Minute)
	return d, nil
}

func migrate(ctx context.Context, d *sql.DB) error {
	if _, err := d.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS schema_versions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			version INTEGER NOT NULL,
			applied_at TIMESTAMP NOT NULL
		);
	`); err != nil {
		return err
	}
	var current int
	if err := d.QueryRowContext(ctx, `SELECT COALESCE(MAX(version),0) FROM schema_versions`).Scan(&current); err != nil {
		return err
	}
	if current >= schemaVersion {
		return nil
	}

	tx, err := d.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT NOT NULL UNIQUE,
			email TEXT NOT NULL UNIQUE,
			email_verified INTEGER NOT NULL DEFAULT 0,
			password_hash TEXT NOT NULL,
			created_at TIMESTAMP NOT NULL,
			updated_at TIMESTAMP NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS events (
			id TEXT PRIMARY KEY,
			creator_id TEXT NOT NULL,
			name TEXT NOT NULL,
			date_from TEXT NOT NULL,
			date_to TEXT NOT NULL,
			duration REAL NOT NULL,
			timezone TEXT NOT NULL,
			disabled_slots TEXT NOT NULL DEFAULT '[]',
			created_at TIMESTAMP NOT NULL,
			updated_at TIMESTAMP NOT NULL,
			FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS event_participants (
			id TEXT PRIMARY KEY,
			event_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			availability TEXT NOT NULL DEFAULT '{}',
			created_at TIMESTAMP NOT NULL,
			updated_at TIMESTAMP NOT NULL,
			UNIQUE(event_id, user_id),
			FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS refresh_tokens (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			family_id TEXT NOT NULL,
			version INTEGER NOT NULL,
			token_hash TEXT NOT NULL,
			expires_at TIMESTAMP NOT NULL,
			created_at TIMESTAMP NOT NULL,
			revoked INTEGER NOT NULL DEFAULT 0,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS login_attempts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id TEXT,
			username TEXT,
			ip TEXT,
			created_at TIMESTAMP NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS email_tokens (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			kind TEXT NOT NULL,
			token_hash TEXT NOT NULL,
			expires_at TIMESTAMP NOT NULL,
			created_at TIMESTAMP NOT NULL,
			used INTEGER NOT NULL DEFAULT 0,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		);`,
		`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`,
		`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
		`CREATE INDEX IF NOT EXISTS idx_events_creator ON events(creator_id);`,
		`CREATE INDEX IF NOT EXISTS idx_participants_event ON event_participants(event_id);`,
		`CREATE INDEX IF NOT EXISTS idx_login_attempts_user ON login_attempts(user_id);`,
		`CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id);`,
		`CREATE INDEX IF NOT EXISTS idx_email_tokens_kind_expires ON email_tokens(kind, expires_at);`,
	}
	for _, s := range stmts {
		if _, err := tx.ExecContext(ctx, s); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO schema_versions(version, applied_at) VALUES (?,?)`, schemaVersion, time.Now().UTC()); err != nil {
		return err
	}
	return tx.Commit()
}

// Rate limiting helpers (unchanged)
type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

var (
	muVisitors sync.Mutex
	visitors   = map[string]*visitor{}
)

func getVisitor(ip string, rps rate.Limit, burst int) *rate.Limiter {
	muVisitors.Lock()
	defer muVisitors.Unlock()
	v, ok := visitors[ip]
	if !ok {
		lim := rate.NewLimiter(rps, burst)
		visitors[ip] = &visitor{limiter: lim, lastSeen: time.Now()}
		return lim
	}
	v.lastSeen = time.Now()
	return v.limiter
}

func cleanupVisitorsLoop() {
	for {
		time.Sleep(time.Minute)
		muVisitors.Lock()
		for ip, v := range visitors {
			if time.Since(v.lastSeen) > 3*time.Minute {
				delete(visitors, ip)
			}
		}
		muVisitors.Unlock()
	}
}

func cleanupLoginAttemptsLoop() {
	for {
		time.Sleep(1 * time.Hour)
		cutoff := time.Now().Add(-24 * time.Hour)
		if _, err := db.Exec(`DELETE FROM login_attempts WHERE created_at < ?`, cutoff.UTC()); err != nil {
			log.Printf("login_attempts cleanup error: %v", err)
		}
	}
}

func rateLimit(rps rate.Limit, burst int) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := clientIP(c)
		lim := getVisitor(ip, rps, burst)
		if !lim.Allow() {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "Too many requests"})
			return
		}
		c.Next()
	}
}

// Security headers
func securityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "no-referrer")
		c.Header("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'; form-action 'self';")
		c.Next()
	}
}

// Helpers
func clientIP(c *gin.Context) string {
	ip := c.ClientIP()
	if ip == "" {
		ip = "unknown"
	}
	return ip
}

func logIfTimeout(err error, where string) {
	if errors.Is(err, context.DeadlineExceeded) {
		log.Printf("timeout: %s: %v", where, err)
	}
}

func serverError(c *gin.Context, where string, err error) {
	if err != nil {
		logIfTimeout(err, where)
		log.Printf("%s error: %v", where, err)
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
}

func getEnvInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

// API base (for backend links)
func apiBaseURL() string {
	if v := os.Getenv("NEXT_PUBLIC_API_BASE_URL"); v != "" {
		return v
	}
	if v := os.Getenv("API_BASE_URL"); v != "" {
		return v
	}
	return "http://localhost:8080"
}

// Login attempts (unchanged)
func recordLoginAttempt(ctx context.Context, username, userID, ip string) {
	_, err := db.ExecContext(ctx, `INSERT INTO login_attempts(user_id, username, ip, created_at) VALUES (?,?,?,?)`,
		userID, username, ip, time.Now().UTC())
	if err != nil {
		logIfTimeout(err, "recordLoginAttempt")
	}
}

func isLockedOut(ctx context.Context, userID string) (bool, error) {
	var count int
	cutoff := time.Now().Add(-lockoutWindow)
	err := db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM login_attempts
		WHERE user_id = ? AND created_at >= ?
	`, userID, cutoff.UTC()).Scan(&count)
	if err != nil {
		logIfTimeout(err, "isLockedOut")
		return false, err
	}
	return count >= lockoutThreshold, nil
}

// CORS and cookies (unchanged)
func buildCORS() cors.Config {
	cfg := cors.DefaultConfig()
	origins := os.Getenv("CORS_ORIGINS")
	if origins == "" {
		cfg.AllowAllOrigins = true
	} else {
		parts := strings.Split(origins, ",")
		for i := range parts {
			parts[i] = strings.TrimSpace(parts[i])
		}
		cfg.AllowOrigins = parts
	}
	cfg.AllowHeaders = []string{"Origin", "Content-Type", "Authorization"}
	cfg.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	cfg.AllowCredentials = true
	return cfg
}

func setRefreshCookie(c *gin.Context, token string, expiresAt time.Time, remember bool) {
	c.SetSameSite(http.SameSiteLaxMode)
	maxAge := 0
	if remember {
		remaining := int(time.Until(expiresAt) / time.Second)
		if remaining > 0 {
			maxAge = remaining
		}
	}
	c.SetCookie(refreshCookieName, token, maxAge, "/", "", cookieSecure, true)
}

func clearRefreshCookie(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(refreshCookieName, "", -1, "/", "", cookieSecure, true)
}

// Auth middleware (unchanged)
func authnMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		var token string
		if strings.HasPrefix(h, "Bearer ") {
			token = strings.TrimPrefix(h, "Bearer ")
		} else {
			token = c.Query("token")
		}
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		claims, err := parseAccessToken(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		c.Set("userID", claims.UserID)
		c.Next()
	}
}

func ctxUserID(c *gin.Context) string {
	if v, ok := c.Get("userID"); ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// Main
func main() {
	_ = godotenv.Load()
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Fatal("JWT_SECRET not set")
	}
	jwtSecret = []byte(secret)

	if cs := os.Getenv("COOKIE_SECURE"); strings.ToLower(cs) == "false" {
		cookieSecure = false
	}

	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		dbPath = "app.db"
	}

	if rt := os.Getenv("REQUEST_TIMEOUT_MS"); rt != "" {
		if ms, err := strconv.Atoi(rt); err == nil && ms > 0 {
			reqTimeout = time.Duration(ms) * time.Millisecond
		}
	}

	// Brevo / reset config
	brevoAPIKey = os.Getenv("BREVO_API_KEY")
	brevoSenderEmail = os.Getenv("BREVO_SENDER_EMAIL")
	brevoSenderName = os.Getenv("BREVO_SENDER_NAME")
	resetCodeTTL = time.Duration(getEnvInt("RESET_CODE_TTL_MINUTES", 15)) * time.Minute

	var err error
	db, err = openDB(dbPath)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}

	ctx := context.Background()
	if err := migrate(ctx, db); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	go cleanupVisitorsLoop()
	go cleanupLoginAttemptsLoop()

	r := gin.Default()
	r.Use(securityHeaders())
	r.Use(cors.New(buildCORS()))

	// Health check
	r.GET("/healthz", func(c *gin.Context) {
		if err := db.PingContext(c.Request.Context()); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Auth endpoints with tiered limits
	r.POST("/register", rateLimit(10, 10), registerHandler)
	r.POST("/login", rateLimit(10, 10), loginHandler)
	r.POST("/refresh", rateLimit(10, 10), refreshHandler)
	r.POST("/logout", rateLimit(10, 10), logoutHandler)

	// New email endpoints
	r.GET("/verify-email", rateLimit(10, 10), verifyEmailHandler)
	r.POST("/forgot-password", rateLimit(5, 5), forgotPasswordHandler)
	r.POST("/reset-password", rateLimit(5, 5), resetPasswordHandler)

	// Protected routes
	authProtected := r.Group("/")
	authProtected.Use(authnMiddleware())

	authProtected.PUT("/users/me", rateLimit(30, 30), updateUserHandler)
	authProtected.GET("/events/:id/stream", rateLimit(60, 60), sseHandler)

	authProtected.POST("/events", rateLimit(20, 20), createEventHandler)
	r.GET("/events/:id", rateLimit(60, 60), getEventHandler)
	authProtected.PUT("/events/:id", rateLimit(30, 30), updateEventHandler)
	authProtected.DELETE("/events/:id", rateLimit(20, 20), deleteEventHandler)

	authProtected.POST("/events/:id/invite", rateLimit(20, 20), inviteHandler)
	authProtected.POST("/events/:id/join", rateLimit(20, 20), joinHandler)
	authProtected.POST("/events/:id/leave", rateLimit(20, 20), leaveHandler)

	authProtected.GET("/my-events", rateLimit(30, 30), myEventsHandler)

	srv := &http.Server{
		Addr:    ":8080",
		Handler: r,
		BaseContext: func(l net.Listener) context.Context {
			return context.Background()
		},
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()
	log.Println("Server running on :8080")

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down...")
	ctxShutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctxShutdown); err != nil {
		log.Printf("server shutdown error: %v", err)
	}
	if err := db.Close(); err != nil {
		log.Printf("db close error: %v", err)
	}
}

// Handlers

func registerHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), reqTimeout)
	defer cancel()

	var input struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	if !validateUsername(input.Username) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid username"})
		return
	}
	if !validateEmail(input.Email) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email"})
		return
	}
	if !validatePassword(input.Password) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Weak password (>=8 chars with number and special)"})
		return
	}

	var exists int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE username = ? OR email = ?`, input.Username, input.Email).Scan(&exists); err != nil {
		serverError(c, "register: count user", err)
		return
	}
	if exists > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username or email already taken"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), 12)
	if err != nil {
		serverError(c, "register: hash", err)
		return
	}
	now := time.Now().UTC()
	id := uuid.NewString()
	if _, err := db.ExecContext(ctx, `INSERT INTO users(id, username, email, email_verified, password_hash, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`,
		id, input.Username, input.Email, 0, string(hash), now, now); err != nil {
		serverError(c, "register: insert user", err)
		return
	}

	raw, tokenID, err := createEmailToken(id, "verify", 48*time.Hour)
	if err == nil {
		apiURL := apiBaseURL()
		verifyURL := fmt.Sprintf("%s/verify-email?tid=%s&t=%s", apiURL, tokenID, raw)
		html := fmt.Sprintf(`<p>Welcome %s,</p><p>Please verify your email by clicking <a href="%s">this link</a>. The link expires in 48 hours.</p>`, input.Username, verifyURL)
		go func() {
			if err := sendEmailBrevo(input.Email, "Verify your account", html); err != nil {
				log.Printf("sendEmailBrevo verify: %v", err)
			}
		}()
	}

	c.JSON(http.StatusCreated, gin.H{"id": id, "username": input.Username})
}

func loginHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), reqTimeout)
	defer cancel()

	var input struct {
		Username   string `json:"username"`
		Password   string `json:"password"`
		RememberMe bool   `json:"rememberMe"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	if input.Username == "" || input.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing fields"})
		return
	}

	var u User
	err := db.QueryRowContext(ctx, `SELECT id, username, password_hash, email_verified FROM users WHERE username = ?`, input.Username).
		Scan(&u.ID, &u.Username, &u.PasswordHash, &u.EmailVerified)
	if err == sql.ErrNoRows {
		recordLoginAttempt(ctx, "", input.Username, clientIP(c))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	} else if err != nil {
		serverError(c, "login: select user", err)
		return
	}

	locked, err := isLockedOut(ctx, u.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	if locked {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Account locked. Try later."})
		return
	}

	if !u.EmailVerified {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Email not verified"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(input.Password)); err != nil {
		recordLoginAttempt(ctx, u.ID, input.Username, clientIP(c))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	access, err := signAccessToken(u.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	family := uuid.NewString()
	version := 1
	now := time.Now().UTC()
	refreshExpires := now.Add(refreshTTL)
	remember := input.RememberMe
	if !remember {
		refreshExpires = now.Add(refreshTTLShort)
	}

	refresh, rtID, err := signRefreshToken(u.ID, family, version, refreshExpires)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	rtHash, err := hashToken(refresh)
	if err != nil {
		serverError(c, "login: hash refresh", err)
		return
	}

	if _, err := db.ExecContext(ctx, `INSERT INTO refresh_tokens(id, user_id, family_id, version, token_hash, expires_at, created_at, revoked)
		VALUES (?,?,?,?,?,?,?,0)`,
		rtID, u.ID, family, version, string(rtHash), refreshExpires, now); err != nil {
		serverError(c, "login: insert refresh", err)
		return
	}

	setRefreshCookie(c, refresh, refreshExpires, remember)

	c.JSON(http.StatusOK, gin.H{
		"token":         access,
		"refresh_token": refresh,
		"username":      u.Username,
	})
}

func refreshHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), reqTimeout)
	defer cancel()

	var input struct {
		RefreshToken string `json:"refresh_token"`
	}
	_ = c.BindJSON(&input)
	if input.RefreshToken == "" {
		if cookie, err := c.Cookie(refreshCookieName); err == nil {
			input.RefreshToken = cookie
		}
	}
	if input.RefreshToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing refresh token"})
		return
	}

	parsed, err := jwt.ParseWithClaims(input.RefreshToken, &jwt.RegisteredClaims{}, func(t *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil || !parsed.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}
	claims, _ := parsed.Claims.(*jwt.RegisteredClaims)
	if claims == nil || claims.ID == "" || claims.Subject == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	userID := claims.Subject
	rtID := claims.ID
	parts := strings.Split(rtID, ":")
	if len(parts) != 2 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}
	family := parts[0]
	version, _ := strconv.Atoi(parts[1])

	var stored RefreshToken
	err = db.QueryRowContext(ctx, `SELECT id, user_id, family_id, version, token_hash, expires_at, revoked FROM refresh_tokens WHERE id = ?`, rtID).
		Scan(&stored.ID, &stored.UserID, &stored.FamilyID, &stored.Version, &stored.TokenHash, &stored.ExpiresAt, &stored.Revoked)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	} else if err != nil {
		serverError(c, "refresh: select token", err)
		return
	}
	if stored.Revoked || time.Now().After(stored.ExpiresAt) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Expired or revoked"})
		return
	}
	if stored.UserID != userID || stored.FamilyID != family || stored.Version != version {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}
	if err := verifyTokenHash(stored.TokenHash, input.RefreshToken); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	expires := stored.ExpiresAt
	newVersion := version + 1
	newRefresh, newRtID, err := signRefreshToken(userID, family, newVersion, expires)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	newHash, err := hashToken(newRefresh)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	now := time.Now().UTC()

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	if _, err := tx.ExecContext(ctx, `UPDATE refresh_tokens SET revoked = 1 WHERE id = ?`, rtID); err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO refresh_tokens(id, user_id, family_id, version, token_hash, expires_at, created_at, revoked)
		VALUES (?,?,?,?,?,?,?,0)
	`, newRtID, userID, family, newVersion, string(newHash), expires, now); err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	access, err := signAccessToken(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	remember := time.Until(expires) > 0
	setRefreshCookie(c, newRefresh, expires, remember)

	c.JSON(http.StatusOK, gin.H{
		"token":         access,
		"refresh_token": newRefresh,
	})
}

func logoutHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), reqTimeout)
	defer cancel()

	var input struct {
		RefreshToken string `json:"refresh_token"`
	}
	_ = c.BindJSON(&input)
	if input.RefreshToken == "" {
		if cookie, err := c.Cookie(refreshCookieName); err == nil {
			input.RefreshToken = cookie
		}
	}
	clearRefreshCookie(c)

	if input.RefreshToken == "" {
		c.JSON(http.StatusOK, gin.H{"message": "Logged out"})
		return
	}

	parsed, err := jwt.ParseWithClaims(input.RefreshToken, &jwt.RegisteredClaims{}, func(t *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil || !parsed.Valid {
		c.JSON(http.StatusOK, gin.H{"message": "Logged out"})
		return
	}
	claims, _ := parsed.Claims.(*jwt.RegisteredClaims)
	if claims == nil || claims.ID == "" {
		c.JSON(http.StatusOK, gin.H{"message": "Logged out"})
		return
	}

	if _, err := db.ExecContext(ctx, `UPDATE refresh_tokens SET revoked = 1 WHERE id = ?`, claims.ID); err != nil {
		logIfTimeout(err, "logout: revoke")
	}

	c.JSON(http.StatusOK, gin.H{"message": "Logged out"})
}

func updateUserHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), reqTimeout)
	defer cancel()

	userID := ctxUserID(c)
	var input struct {
		Username    string `json:"username"`
		OldPassword string `json:"oldPassword"`
		NewPassword string `json:"newPassword"`
		Email       string `json:"email"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	defer tx.Rollback()

	var current User
	if err := tx.QueryRowContext(ctx, `SELECT id, username, password_hash, email FROM users WHERE id = ?`, userID).
		Scan(&current.ID, &current.Username, &current.PasswordHash, &current.Email); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	updatedUsername := current.Username
	if input.Username != "" && input.Username != current.Username {
		if !validateUsername(input.Username) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid username"})
			return
		}
		var count int
		if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE username = ? AND id <> ?`, input.Username, userID).Scan(&count); err != nil {
			serverError(c, "updateUser: username count", err)
			return
		}
		if count > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Username taken"})
			return
		}
		updatedUsername = input.Username
	}

	updatedEmail := current.Email
	if input.Email != "" && input.Email != current.Email {
		if !validateEmail(input.Email) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email"})
			return
		}
		var count int
		if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE email = ? AND id <> ?`, input.Email, userID).Scan(&count); err != nil {
			serverError(c, "updateUser: email count", err)
			return
		}
		if count > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Email taken"})
			return
		}
		updatedEmail = input.Email
	}

	updatedHash := current.PasswordHash
	changedPassword := false
	if input.NewPassword != "" {
		if !validatePassword(input.NewPassword) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Weak password"})
			return
		}
		if err := bcrypt.CompareHashAndPassword([]byte(current.PasswordHash), []byte(input.OldPassword)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Current password incorrect"})
			return
		}
		h, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), 12)
		if err != nil {
			serverError(c, "updateUser: hash new password", err)
			return
		}
		updatedHash = string(h)
		changedPassword = true
	}

	now := time.Now().UTC()
	if _, err := tx.ExecContext(ctx, `
		UPDATE users SET username = ?, email = ?, password_hash = ?, updated_at = ? WHERE id = ?
	`, updatedUsername, updatedEmail, updatedHash, now, userID); err != nil {
		serverError(c, "updateUser: update user", err)
		return
	}

	if input.Email != "" && input.Email != current.Email {
		if _, err := tx.ExecContext(ctx, `UPDATE users SET email_verified = 0 WHERE id = ?`, userID); err != nil {
			serverError(c, "updateUser: set unverified", err)
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
			return
		}
		raw, tokenID, err := createEmailToken(userID, "verify", 48*time.Hour)
		if err == nil {
			apiURL := apiBaseURL()
			verifyURL := fmt.Sprintf("%s/verify-email?tid=%s&t=%s", apiURL, tokenID, raw)
			html := fmt.Sprintf(`<p>Please verify your new email by clicking <a href="%s">this link</a></p>`, verifyURL)
			go func() {
				if err := sendEmailBrevo(updatedEmail, "Verify your email", html); err != nil {
					log.Printf("sendEmailBrevo verify-change: %v", err)
				}
			}()
		}
		c.JSON(http.StatusOK, gin.H{"username": updatedUsername})
		return
	}

	if changedPassword {
		if _, err := tx.ExecContext(ctx, `UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?`, userID); err != nil {
			serverError(c, "updateUser: revoke refresh", err)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"username": updatedUsername})
}

func sseHandler(c *gin.Context) {
	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Streaming unsupported"})
		return
	}

	eventID := c.Param("id")

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")

	sub := sseSubscribe(eventID)
	defer sseUnsubscribe(eventID, sub)

	fmt.Fprintf(c.Writer, "event: ping\ndata: ok\n\n")
	flusher.Flush()

	ping := time.NewTicker(ssePingEvery)
	defer ping.Stop()

	notify := c.Writer.CloseNotify()
	ctx := c.Request.Context()

	for {
		select {
		case <-notify:
			return
		case <-ctx.Done():
			return
		case <-ping.C:
			fmt.Fprintf(c.Writer, "event: ping\ndata: ok\n\n")
			flusher.Flush()
		case msg, ok := <-sub.ch:
			if !ok {
				return
			}
			fmt.Fprintf(c.Writer, "data: %s\n\n", msg)
			flusher.Flush()
		}
	}
}

func createEventHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), reqTimeout)
	defer cancel()

	userID := ctxUserID(c)
	var input map[string]interface{}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	id, _ := input["id"].(string)
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing event id"})
		return
	}

	name, _ := input["name"].(string)
	drRaw, _ := input["dateRange"].(map[string]interface{})
	from, _ := drRaw["from"].(string)
	to, _ := drRaw["to"].(string)
	dur, _ := input["duration"].(float64)
	tz, _ := input["timezone"].(string)
	if name == "" || from == "" || to == "" || dur <= 0 || tz == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing fields"})
		return
	}

	partsRaw, _ := input["participants"].([]interface{})
	disabledRaw, _ := input["disabledSlots"].([]interface{})
	disabledJSON, err := json.Marshal(disabledRaw)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	availability := map[string]bool{}
	availJSON, err := json.Marshal(availability)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	now := time.Now().UTC()

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO events(id, creator_id, name, date_from, date_to, duration, timezone, disabled_slots, created_at, updated_at)
		VALUES (?,?,?,?,?,?,?,?,?,?)
	`, id, userID, name, from, to, dur, tz, string(disabledJSON), now, now); err != nil {
		tx.Rollback()
		logIfTimeout(err, "createEvent: insert event")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not create event"})
		return
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO event_participants(id, event_id, user_id, availability, created_at, updated_at)
		VALUES (?,?,?,?,?,?)
	`, uuid.NewString(), id, userID, string(availJSON), now, now); err != nil {
		tx.Rollback()
		logIfTimeout(err, "createEvent: insert self participant")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not add participant"})
		return
	}

	for _, p := range partsRaw {
		if m, ok := p.(map[string]interface{}); ok {
			pid, _ := m["id"].(string)
			if pid != "" && pid != userID {
				if _, err := tx.ExecContext(ctx, `
					INSERT OR IGNORE INTO event_participants(id, event_id, user_id, availability, created_at, updated_at)
					VALUES (?,?,?,?,?,?)
				`, uuid.NewString(), id, pid, "{}", now, now); err != nil {
					tx.Rollback()
					logIfTimeout(err, "createEvent: insert other participant")
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not add participant"})
					return
				}
			}
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	ssePublish(id, []byte(`{"type":"event_updated","id":"`+id+`"}`))

	c.JSON(http.StatusCreated, gin.H{
		"id":            id,
		"creatorId":     userID,
		"name":          name,
		"dateRange":     gin.H{"from": from, "to": to},
		"duration":      dur,
		"timezone":      tz,
		"participants":  []interface{}{map[string]interface{}{"id": userID, "name": ""}},
		"disabledSlots": disabledRaw,
	})
}

func getEventHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), reqTimeout)
	defer cancel()

	id := c.Param("id")
	var ev Event
	err := db.QueryRowContext(ctx, `
		SELECT id, creator_id, name, date_from, date_to, duration, timezone, disabled_slots
		FROM events WHERE id = ?
	`, id).Scan(&ev.ID, &ev.CreatorID, &ev.Name, &ev.DateFrom, &ev.DateTo, &ev.Duration, &ev.Timezone, &ev.DisabledSlots)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	} else if err != nil {
		logIfTimeout(err, "getEvent: select")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	parts := []map[string]interface{}{}
	rows, err := db.QueryContext(ctx, `
		SELECT ep.user_id, u.username, ep.availability
		FROM event_participants ep
		JOIN users u ON u.id = ep.user_id
		WHERE ep.event_id = ?
	`, id)
	if err != nil {
		logIfTimeout(err, "getEvent: query participants")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	defer rows.Close()
	for rows.Next() {
		var uid, uname, availJSON string
		if err := rows.Scan(&uid, &uname, &availJSON); err == nil {
			partAvail := map[string]bool{}
			if err := json.Unmarshal([]byte(availJSON), &partAvail); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
				return
			}
			parts = append(parts, map[string]interface{}{
				"id":           uid,
				"name":         uname,
				"availability": partAvail,
			})
		}
	}
	if err := rows.Err(); err != nil {
		logIfTimeout(err, "getEvent: rows err")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	disabled := []string{}
	if err := json.Unmarshal([]byte(ev.DisabledSlots), &disabled); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":            ev.ID,
		"creatorId":     ev.CreatorID,
		"name":          ev.Name,
		"dateRange":     gin.H{"from": ev.DateFrom, "to": ev.DateTo},
		"duration":      ev.Duration,
		"timezone":      ev.Timezone,
		"participants":  parts,
		"disabledSlots": disabled,
	})
}

func updateEventHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), reqTimeout)
	defer cancel()

	id := c.Param("id")
	userID := ctxUserID(c)

	var input EventUpdate
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}
	if input.ID == "" || input.Name == "" || input.DateRange == nil || input.DateRange["from"] == "" || input.DateRange["to"] == "" || input.Duration <= 0 || input.Timezone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required fields"})
		return
	}

	var creatorID string
	err := db.QueryRowContext(ctx, `SELECT creator_id FROM events WHERE id = ?`, id).Scan(&creatorID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	} else if err != nil {
		logIfTimeout(err, "updateEvent: select creator")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	isCreator := creatorID == userID
	if isCreator {
		disabledJSON, err := json.Marshal(input.DisabledSlots)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
			return
		}
		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
			return
		}
		now := time.Now().UTC()

		if _, err := tx.ExecContext(ctx, `
			UPDATE events SET name = ?, date_from = ?, date_to = ?, duration = ?, timezone = ?, disabled_slots = ?, updated_at = ?
			WHERE id = ?
		`, input.Name, input.DateRange["from"], input.DateRange["to"], input.Duration, input.Timezone, string(disabledJSON), now, id); err != nil {
			tx.Rollback()
			logIfTimeout(err, "updateEvent: update event")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
			return
		}

		if len(input.Participants) > 0 {
			if _, err := tx.ExecContext(ctx, `DELETE FROM event_participants WHERE event_id = ?`, id); err != nil {
				tx.Rollback()
				logIfTimeout(err, "updateEvent: delete participants")
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
				return
			}
			for _, p := range input.Participants {
				pid, _ := p["id"].(string)
				if pid == "" {
					continue
				}
				avail := map[string]bool{}
				if raw, ok := p["availability"].(map[string]interface{}); ok {
					for k, v := range raw {
						if b, ok := v.(bool); ok && b {
							avail[k] = true
						}
					}
				}
				availJSON, err := json.Marshal(avail)
				if err != nil {
					tx.Rollback()
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
					return
				}
				if _, err := tx.ExecContext(ctx, `
					INSERT INTO event_participants(id, event_id, user_id, availability, created_at, updated_at)
					VALUES (?,?,?,?,?,?)
				`, uuid.NewString(), id, pid, string(availJSON), now, now); err != nil {
					tx.Rollback()
					logIfTimeout(err, "updateEvent: insert participants")
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
					return
				}
			}
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
			return
		}

		ssePublish(id, []byte(`{"type":"event_updated","id":"`+id+`"}`))
		c.JSON(http.StatusOK, gin.H{"status": "updated"})
		return
	}

	var count int
	_ = db.QueryRowContext(ctx, `SELECT COUNT(*) FROM event_participants WHERE event_id = ? AND user_id = ?`, id, userID).Scan(&count)
	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: Not a participant"})
		return
	}

	var incomingAvail map[string]bool
	for _, p := range input.Participants {
		if pid, ok := p["id"].(string); ok && pid == userID {
			if raw, ok := p["availability"].(map[string]interface{}); ok {
				incomingAvail = map[string]bool{}
				for k, v := range raw {
					if b, ok := v.(bool); ok && b {
						incomingAvail[k] = true
					}
				}
			}
			break
		}
	}
	if incomingAvail == nil {
		c.JSON(http.StatusOK, gin.H{"status": "no changes"})
		return
	}
	availJSON, err := json.Marshal(incomingAvail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	now := time.Now().UTC()
	if _, err := db.ExecContext(ctx, `
		UPDATE event_participants SET availability = ?, updated_at = ? WHERE event_id = ? AND user_id = ?
	`, string(availJSON), now, id, userID); err != nil {
		logIfTimeout(err, "updateEvent: update availability")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	ssePublish(id, []byte(`{"type":"event_updated","id":"`+id+`"}`))
	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func deleteEventHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), reqTimeout)
	defer cancel()

	id := c.Param("id")
	userID := ctxUserID(c)

	var creatorID string
	err := db.QueryRowContext(ctx, `SELECT creator_id FROM events WHERE id = ?`, id).Scan(&creatorID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	} else if err != nil {
		logIfTimeout(err, "deleteEvent: select creator")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	if creatorID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only creator can delete"})
		return
	}
	if _, err := db.ExecContext(ctx, `DELETE FROM events WHERE id = ?`, id); err != nil {
		logIfTimeout(err, "deleteEvent: delete")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	ssePublish(id, []byte(`{"type":"event_deleted","id":"`+id+`"}`))
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// Invite handler: hides username existence to avoid enumeration
func inviteHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), reqTimeout)
	defer cancel()

	id := c.Param("id")
	creatorID := ctxUserID(c)
	var body struct {
		Username string `json:"username"`
	}
	if err := c.BindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	var evCreator string
	if err := db.QueryRowContext(ctx, `SELECT creator_id FROM events WHERE id = ?`, id).Scan(&evCreator); err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		logIfTimeout(err, "invite: select creator")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	if evCreator != creatorID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only creator can invite"})
		return
	}

	var targetID string
	err := db.QueryRowContext(ctx, `SELECT id FROM users WHERE username = ?`, body.Username).Scan(&targetID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusOK, gin.H{"message": "Invite processed"})
		return
	} else if err != nil {
		logIfTimeout(err, "invite: select user")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	var exists int
	_ = db.QueryRowContext(ctx, `SELECT COUNT(*) FROM event_participants WHERE event_id = ? AND user_id = ?`, id, targetID).Scan(&exists)
	if exists > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "User already in event"})
		return
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	now := time.Now().UTC()
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO event_participants(id, event_id, user_id, availability, created_at, updated_at)
		VALUES (?,?,?,?,?,?)
	`, uuid.NewString(), id, targetID, "{}", now, now); err != nil {
		tx.Rollback()
		logIfTimeout(err, "invite: insert participant")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	ssePublish(id, []byte(`{"type":"event_updated","id":"`+id+`"}`))
	c.JSON(http.StatusOK, gin.H{"message": "Invite processed"})
}

func joinHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), reqTimeout)
	defer cancel()

	id := c.Param("id")
	userID := ctxUserID(c)

	var exists int
	err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM events WHERE id = ?`, id).Scan(&exists)
	if err != nil {
		logIfTimeout(err, "join: select event")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	if exists == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	_ = db.QueryRowContext(ctx, `SELECT COUNT(*) FROM event_participants WHERE event_id = ? AND user_id = ?`, id, userID).Scan(&exists)
	if exists > 0 {
		c.JSON(http.StatusOK, gin.H{"message": "Already joined"})
		return
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	now := time.Now().UTC()
	if _, err := tx.ExecContext(ctx, `INSERT INTO event_participants(id, event_id, user_id, availability, created_at, updated_at)
		VALUES (?,?,?,?,?,?)`, uuid.NewString(), id, userID, "{}", now, now); err != nil {
		tx.Rollback()
		logIfTimeout(err, "join: insert participant")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	ssePublish(id, []byte(`{"type":"event_updated","id":"`+id+`"}`))
	c.JSON(http.StatusOK, gin.H{"message": "Joined"})
}

func leaveHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), reqTimeout)
	defer cancel()

	id := c.Param("id")
	userID := ctxUserID(c)
	res, err := db.ExecContext(ctx, `DELETE FROM event_participants WHERE event_id = ? AND user_id = ?`, id, userID)
	if err != nil {
		logIfTimeout(err, "leave: delete")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Not in event"})
		return
	}

	ssePublish(id, []byte(`{"type":"event_updated","id":"`+id+`"}`))
	c.JSON(http.StatusOK, gin.H{"message": "Left event"})
}

func myEventsHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), reqTimeout)
	defer cancel()

	userID := ctxUserID(c)
	rows, err := db.QueryContext(ctx, `
		SELECT e.id, e.creator_id, e.name, e.date_from, e.date_to, e.duration, e.timezone, e.disabled_slots,
			CASE WHEN e.creator_id = ? THEN 1 ELSE 0 END as is_owner
		FROM events e
		LEFT JOIN event_participants ep ON ep.event_id = e.id AND ep.user_id = ?
		WHERE e.creator_id = ? OR ep.user_id = ?
	`, userID, userID, userID, userID)
	if err != nil {
		logIfTimeout(err, "myEvents: query")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	defer rows.Close()
	out := []map[string]interface{}{}
	for rows.Next() {
		var ev Event
		var isOwner int
		if err := rows.Scan(&ev.ID, &ev.CreatorID, &ev.Name, &ev.DateFrom, &ev.DateTo, &ev.Duration, &ev.Timezone, &ev.DisabledSlots, &isOwner); err == nil {
			disabled := []string{}
			if err := json.Unmarshal([]byte(ev.DisabledSlots), &disabled); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
				return
			}
			out = append(out, map[string]interface{}{
				"id":            ev.ID,
				"creatorId":     ev.CreatorID,
				"name":          ev.Name,
				"dateRange":     gin.H{"from": ev.DateFrom, "to": ev.DateTo},
				"duration":      ev.Duration,
				"timezone":      ev.Timezone,
				"disabledSlots": disabled,
				"isOwner":       isOwner == 1,
			})
		}
	}
	if err := rows.Err(); err != nil {
		logIfTimeout(err, "myEvents: rows err")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, out)
}

/* Email token + verification/reset handlers rely on helper functions:
   - createEmailToken(userID, kind, ttl) (rawToken, tokenID, err)
   - verifyEmailTokenByID(tokenID, rawToken, kind) -> userID, error
*/

// verifyEmailHandler - GET used by email link: /verify-email?tid=<id>&t=<raw>
func verifyEmailHandler(c *gin.Context) {
	tid := c.Query("tid")
	raw := c.Query("t")
	if tid == "" || raw == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing token"})
		return
	}
	userID, err := verifyEmailTokenByID(tid, raw, "verify")
	if err != nil {
		appURL := os.Getenv("APP_BASE_URL")
		if appURL == "" {
			appURL = "http://localhost:3000"
		}
		c.Redirect(http.StatusFound, fmt.Sprintf("%s/verified?success=0", appURL))
		return
	}
	if _, err := db.Exec(`UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?`, time.Now().UTC(), userID); err != nil {
		logIfTimeout(err, "verifyEmail: update user")
	}
	appURL := os.Getenv("APP_BASE_URL")
	if appURL == "" {
		appURL = "http://localhost:3000"
	}
	c.Redirect(http.StatusFound, fmt.Sprintf("%s/verified?success=1", appURL))
}

// forgotPasswordHandler - requests a reset (no enumeration leak)
func forgotPasswordHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), reqTimeout)
	defer cancel()
	var in struct {
		EmailOrUsername string `json:"email"`
	}
	_ = c.BindJSON(&in)
	var userID, email string
	err := db.QueryRowContext(ctx, `SELECT id, email FROM users WHERE email = ? OR username = ?`, in.EmailOrUsername, in.EmailOrUsername).
		Scan(&userID, &email)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusOK, gin.H{"message": "If an account exists, we sent a reset link"})
		return
	} else if err != nil {
		serverError(c, "forgotPassword: select user", err)
		return
	}
	raw, tokenID, err := createEmailToken(userID, "reset", resetCodeTTL)
	if err == nil {
		appURL := os.Getenv("APP_BASE_URL")
		if appURL == "" {
			appURL = "http://localhost:3000"
		}
		resetURL := fmt.Sprintf("%s/reset-password?tid=%s&t=%s", appURL, tokenID, raw)
		html := fmt.Sprintf(`<p>To reset your password, click <a href="%s">this link</a>. The link expires in %d minutes.</p>`, resetURL, int(resetCodeTTL.Minutes()))
		go func() {
			if err := sendEmailBrevo(email, "Reset your password", html); err != nil {
				log.Printf("sendEmailBrevo reset: %v", err)
			}
		}()
	}
	c.JSON(http.StatusOK, gin.H{"message": "If an account exists, we sent a reset link"})
}

// resetPasswordHandler - consumes token + sets new password (with confirmation)
func resetPasswordHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), reqTimeout)
	defer cancel()
	var in struct {
		TokenID            string `json:"tokenId"`
		Token              string `json:"token"`
		NewPassword        string `json:"newPassword"`
		ConfirmNewPassword string `json:"confirmNewPassword"`
	}
	if err := c.BindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	if in.TokenID == "" || in.Token == "" || in.NewPassword == "" || in.ConfirmNewPassword == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing fields"})
		return
	}
	if in.NewPassword != in.ConfirmNewPassword {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Passwords do not match"})
		return
	}
	if !validatePassword(in.NewPassword) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Weak password"})
		return
	}
	userID, err := verifyEmailTokenByID(in.TokenID, in.Token, "reset")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired token"})
		return
	}
	h, err := bcrypt.GenerateFromPassword([]byte(in.NewPassword), 12)
	if err != nil {
		serverError(c, "resetPassword: hash", err)
		return
	}
	if _, err := db.ExecContext(ctx, `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`, string(h), time.Now().UTC(), userID); err != nil {
		serverError(c, "resetPassword: update", err)
		return
	}
	if _, err := db.ExecContext(ctx, `UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?`, userID); err != nil {
		logIfTimeout(err, "resetPassword: revoke")
	}
	c.JSON(http.StatusOK, gin.H{"message": "Password updated"})
}

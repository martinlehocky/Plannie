package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/time/rate"
)

// --- JWT AUTH HELPERS ---

var jwtSecret []byte

func init() {
	_ = godotenv.Load() // optional .env
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Fatal("FATAL: JWT_SECRET environment variable is not set")
	}
	jwtSecret = []byte(secret)
}

type Claims struct {
	UserID   string `json:"uid"`
	Username string `json:"uname"`
	jwt.RegisteredClaims
}

func signToken(userID, username string, ttl time.Duration) (string, error) {
	claims := &Claims{
		UserID:   userID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func verifyToken(tok string) (*Claims, error) {
	if len(jwtSecret) == 0 {
		return nil, errors.New("JWT_SECRET not set")
	}
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

func authnMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			c.AbortWithStatusJSON(401, gin.H{"error": "Unauthorized"})
			return
		}
		token := strings.TrimPrefix(h, "Bearer ")
		if token == "" {
			c.AbortWithStatusJSON(401, gin.H{"error": "Unauthorized"})
			return
		}
		claims, err := verifyToken(token)
		if err != nil {
			c.AbortWithStatusJSON(401, gin.H{"error": "Unauthorized"})
			return
		}
		c.Set("userID", claims.UserID)
		c.Set("username", claims.Username)
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

// --- RATE LIMITING ---

type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

var (
	visitors = make(map[string]*visitor)
	mu       sync.Mutex
)

func getVisitor(ip string) *rate.Limiter {
	mu.Lock()
	defer mu.Unlock()
	v, exists := visitors[ip]
	if !exists {
		limiter := rate.NewLimiter(5, 10)
		visitors[ip] = &visitor{limiter, time.Now()}
		return limiter
	}
	v.lastSeen = time.Now()
	return v.limiter
}

func cleanupVisitors() {
	for {
		time.Sleep(time.Minute)
		mu.Lock()
		for ip, v := range visitors {
			if time.Since(v.lastSeen) > 3*time.Minute {
				delete(visitors, ip)
			}
		}
		mu.Unlock()
	}
}

func rateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		limiter := getVisitor(ip)
		if !limiter.Allow() {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "Too many requests"})
			return
		}
		c.Next()
	}
}

// --- SSE HUB ---

type hub struct {
	subs map[string]map[chan []byte]struct{}
	mu   sync.Mutex
}

func newHub() *hub {
	return &hub{subs: map[string]map[chan []byte]struct{}{}}
}

func (h *hub) add(id string) chan []byte {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.subs[id] == nil {
		h.subs[id] = map[chan []byte]struct{}{}
	}
	ch := make(chan []byte, 1)
	h.subs[id][ch] = struct{}{}
	return ch
}

func (h *hub) remove(id string, ch chan []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.subs[id], ch)
	close(ch)
}

func (h *hub) broadcast(id string, msg []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.subs[id] {
		select {
		case ch <- msg:
		default:
		}
	}
}

// --- DATA STRUCTURES ---

type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type Event struct {
	ID           string                 `json:"id"`
	CreatorID    string                 `json:"creatorId"`
	Data         map[string]interface{} `json:"data"`
	Participants []string               `json:"participants"`
}

type EventUpdate struct {
	ID            string                   `json:"id"`
	Name          string                   `json:"name"`
	DateRange     map[string]string        `json:"dateRange"`
	Duration      float64                  `json:"duration"`
	Timezone      string                   `json:"timezone"`
	Participants  []map[string]interface{} `json:"participants"`
	DisabledSlots []string                 `json:"disabledSlots,omitempty"`
}

// --- STORAGE ---

type DataStore struct {
	sync.RWMutex
	Events map[string]Event
	Users  map[string]User
}

var (
	store = DataStore{
		Events: make(map[string]Event),
		Users:  make(map[string]User),
	}
	sseHub = newHub()
)

// --- PERSISTENCE HELPERS ---

func atomicWrite(filename string, data []byte) error {
	dir := filepath.Dir(filename)
	tmp, err := ioutil.TempFile(dir, "tmp-*.json")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		os.Remove(tmpName)
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		os.Remove(tmpName)
		return err
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmpName)
		return err
	}
	return os.Rename(tmpName, filename)
}

func saveToDisk(filename string, data interface{}) {
	file, _ := json.MarshalIndent(data, "", "  ")
	_ = atomicWrite(filename, file)
}

func loadFromDisk() {
	if data, err := ioutil.ReadFile("users.json"); err == nil {
		_ = json.Unmarshal(data, &store.Users)
	}
	if data, err := ioutil.ReadFile("events.json"); err == nil {
		_ = json.Unmarshal(data, &store.Events)
	}
	log.Printf("Loaded %d events and %d users", len(store.Events), len(store.Users))
}

func mustJSON(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}

// --- UTILITIES ---

// normalizeParts converts participant slices to []interface{} so appends work regardless of stored shape.
func normalizeParts(val interface{}) []interface{} {
	switch v := val.(type) {
	case []interface{}:
		return v
	case []map[string]interface{}:
		res := make([]interface{}, 0, len(v))
		for _, m := range v {
			res = append(res, m)
		}
		return res
	default:
		return []interface{}{}
	}
}

// --- MAIN ---

func main() {
	loadFromDisk()
	go cleanupVisitors()

	r := gin.Default()

	// Body size limit (1MB)
	r.Use(func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1<<20)
		c.Next()
	})

	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:3000"} // tighten in prod
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Authorization"}
	r.Use(cors.New(config))
	r.Use(rateLimitMiddleware())

	// --- AUTH ---

	r.POST("/register", func(c *gin.Context) {
		var input struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := c.BindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": "Invalid input"})
			return
		}
		store.Lock()
		defer store.Unlock()
		for _, u := range store.Users {
			if u.Username == input.Username {
				c.JSON(400, gin.H{"error": "Unable to register with that username"})
				return
			}
		}
		hashed, _ := bcrypt.GenerateFromPassword([]byte(input.Password), 10)
		newUser := User{ID: uuid.New().String(), Username: input.Username, Password: string(hashed)}
		store.Users[newUser.ID] = newUser
		saveToDisk("users.json", store.Users)
		c.JSON(201, gin.H{"id": newUser.ID, "username": newUser.Username})
	})

	r.POST("/login", func(c *gin.Context) {
		var input struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := c.BindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": "Invalid input"})
			return
		}
		store.RLock()
		defer store.RUnlock()
		for _, u := range store.Users {
			if u.Username == input.Username {
				if err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(input.Password)); err == nil {
					tok, _ := signToken(u.ID, u.Username, 24*time.Hour)
					c.JSON(200, gin.H{"token": tok, "username": u.Username})
					return
				}
			}
		}
		c.JSON(401, gin.H{"error": "Invalid credentials"})
	})

	// Protected group
	auth := r.Group("/")
	auth.Use(authnMiddleware())

	auth.PUT("/users/me", func(c *gin.Context) {
		userID := ctxUserID(c)
		var input struct {
			Username    string `json:"username"`
			OldPassword string `json:"oldPassword"`
			NewPassword string `json:"newPassword"`
		}
		if err := c.BindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": "Invalid input"})
			return
		}

		store.Lock()
		defer store.Unlock()

		user, exists := store.Users[userID]
		if !exists {
			c.JSON(404, gin.H{"error": "User not found"})
			return
		}

		updatedUser := user
		nameChanged := false

		if input.Username != "" && input.Username != user.Username {
			for _, u := range store.Users {
				if u.Username == input.Username {
					c.JSON(400, gin.H{"error": "Unable to update username"})
					return
				}
			}
			updatedUser.Username = input.Username
			nameChanged = true
		}

		if input.NewPassword != "" {
			if len(input.NewPassword) < 8 {
				c.JSON(400, gin.H{"error": "Password must be at least 8 characters"})
				return
			}
			if input.OldPassword == "" {
				c.JSON(400, gin.H{"error": "Current password required to set new password"})
				return
			}
			if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.OldPassword)); err != nil {
				c.JSON(401, gin.H{"error": "Current password incorrect"})
				return
			}
			hashed, _ := bcrypt.GenerateFromPassword([]byte(input.NewPassword), 10)
			updatedUser.Password = string(hashed)
		}

		store.Users[userID] = updatedUser
		saveToDisk("users.json", store.Users)

		if nameChanged {
			for id, event := range store.Events {
				updated := false
				if parts, ok := event.Data["participants"].([]interface{}); ok {
					newParts := []interface{}{}
					for _, p := range parts {
						if pMap, ok := p.(map[string]interface{}); ok {
							if pMap["id"] == userID {
								pMap["name"] = updatedUser.Username
								updated = true
							}
							newParts = append(newParts, pMap)
						}
					}
					event.Data["participants"] = newParts
				}
				if updated {
					store.Events[id] = event
				}
			}
			saveToDisk("events.json", store.Events)
		}

		c.JSON(200, gin.H{"username": updatedUser.Username})
	})

	// --- SSE subscribe (protected & participant/creator only) ---
	auth.GET("/events/:id/stream", func(c *gin.Context) {
		id := c.Param("id")
		userID := ctxUserID(c)

		store.RLock()
		ev, ok := store.Events[id]
		store.RUnlock()
		if !ok {
			c.JSON(404, gin.H{"error": "Not found"})
			return
		}
		allowed := ev.CreatorID == userID
		if !allowed {
			for _, pid := range ev.Participants {
				if pid == userID {
					allowed = true
					break
				}
			}
		}
		if !allowed {
			c.JSON(403, gin.H{"error": "Forbidden"})
			return
		}

		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")

		ch := sseHub.add(id)
		defer sseHub.remove(id, ch)

		c.Stream(func(w io.Writer) bool {
			if msg, ok := <-ch; ok {
				c.SSEvent("update", string(msg))
				return true
			}
			return false
		})
	})

	// --- EVENTS ---

	auth.POST("/events", func(c *gin.Context) {
		var input map[string]interface{}
		if err := c.BindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": "Invalid JSON"})
			return
		}

		creatorID := ctxUserID(c)
		if creatorID == "" {
			c.JSON(401, gin.H{"error": "Login required"})
			return
		}

		store.RLock()
		creator, ok := store.Users[creatorID]
		store.RUnlock()
		if !ok {
			c.JSON(401, gin.H{"error": "Invalid user"})
			return
		}

		id, _ := input["id"].(string)
		if id == "" {
			c.JSON(400, gin.H{"error": "Missing event id"})
			return
		}

		participants := []string{creatorID}

		if input["participants"] == nil {
			input["participants"] = []interface{}{}
		}
		if list, ok := input["participants"].([]interface{}); ok {
			newParticipant := map[string]interface{}{
				"id":           creatorID,
				"name":         creator.Username,
				"availability": map[string]bool{},
			}
			input["participants"] = append(list, newParticipant)
		}

		input["creatorId"] = creatorID

		store.Lock()
		store.Events[id] = Event{ID: id, CreatorID: creatorID, Data: input, Participants: participants}
		store.Unlock()
		saveToDisk("events.json", store.Events)

		go sseHub.broadcast(id, mustJSON(input))
		c.JSON(201, input)
	})

	r.GET("/events/:id", func(c *gin.Context) {
		id := c.Param("id")
		store.RLock()
		event, exists := store.Events[id]
		store.RUnlock()
		if !exists {
			c.JSON(404, gin.H{"error": "Not found"})
			return
		}
		res := make(map[string]interface{})
		for k, v := range event.Data {
			res[k] = v
		}
		res["creatorId"] = event.CreatorID
		c.JSON(200, res)
	})

	auth.PUT("/events/:id", func(c *gin.Context) {
		id := c.Param("id")
		userID := ctxUserID(c)
		if userID == "" {
			c.JSON(401, gin.H{"error": "Unauthorized"})
			return
		}

		var input EventUpdate
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": "Invalid JSON"})
			return
		}
		if input.ID == "" || input.Name == "" || input.DateRange == nil || input.DateRange["from"] == "" || input.DateRange["to"] == "" || input.Duration <= 0 || input.Timezone == "" {
			c.JSON(400, gin.H{"error": "Missing required fields"})
			return
		}

		store.Lock()
		defer store.Unlock()

		event, exists := store.Events[id]
		if !exists {
			c.JSON(404, gin.H{"error": "Not found"})
			return
		}

		isCreator := event.CreatorID == userID

		if isCreator {
			newParts := []string{}
			if len(input.Participants) > 0 {
				for _, p := range input.Participants {
					if pid, ok := p["id"].(string); ok && pid != "" {
						newParts = append(newParts, pid)
					}
				}
			}

			event.Data = map[string]interface{}{
				"id":           input.ID,
				"name":         input.Name,
				"dateRange":    input.DateRange,
				"duration":     input.Duration,
				"timezone":     input.Timezone,
				"participants": normalizeParts(input.Participants),
				"creatorId":    event.CreatorID,
			}
			if input.DisabledSlots != nil {
				event.Data["disabledSlots"] = input.DisabledSlots
			}
			if len(newParts) > 0 {
				event.Participants = newParts
			}

			store.Events[id] = event
			saveToDisk("events.json", store.Events)
			go sseHub.broadcast(id, mustJSON(event.Data))
			c.JSON(200, event.Data)
			return
		}

		// Non-creator: allow only updating their own availability
		partsRaw := normalizeParts(event.Data["participants"])

		var incomingAvail map[string]bool
		for _, p := range input.Participants {
			if pid, ok := p["id"].(string); ok && pid == userID {
				if avail, ok := p["availability"].(map[string]interface{}); ok {
					incomingAvail = map[string]bool{}
					for k, v := range avail {
						if b, ok := v.(bool); ok && b {
							incomingAvail[k] = true
						}
					}
				}
				break
			}
		}

		if incomingAvail == nil {
			c.JSON(200, event.Data)
			return
		}

		updatedParts := []interface{}{}
		updated := false
		for _, p := range partsRaw {
			if pMap, ok := p.(map[string]interface{}); ok {
				if pMap["id"] == userID {
					pMap["availability"] = incomingAvail
					updated = true
				}
				updatedParts = append(updatedParts, pMap)
			}
		}
		if !updated {
			c.JSON(403, gin.H{"error": "Forbidden: Not a participant"})
			return
		}

		event.Data["participants"] = updatedParts
		if ds, ok := event.Data["disabledSlots"]; ok {
			event.Data["disabledSlots"] = ds
		}
		event.Data["creatorId"] = event.CreatorID

		store.Events[id] = event
		saveToDisk("events.json", store.Events)

		go sseHub.broadcast(id, mustJSON(event.Data))
		c.JSON(200, event.Data)
	})

	auth.DELETE("/events/:id", func(c *gin.Context) {
		id := c.Param("id")
		userID := ctxUserID(c)
		store.Lock()
		defer store.Unlock()
		event, exists := store.Events[id]
		if !exists {
			c.JSON(404, gin.H{"error": "Not found"})
			return
		}
		if event.CreatorID != userID {
			c.JSON(403, gin.H{"error": "Only creator can delete"})
			return
		}
		delete(store.Events, id)
		saveToDisk("events.json", store.Events)

		go sseHub.broadcast(id, mustJSON(gin.H{"deleted": true}))
		c.JSON(200, gin.H{"message": "Deleted"})
	})

	// --- INVITES / JOIN / LEAVE ---
	auth.POST("/events/:id/invite", func(c *gin.Context) {
		id := c.Param("id")
		creatorID := ctxUserID(c)
		var input struct {
			Username string `json:"username"`
		}
		if err := c.BindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": "Invalid input"})
			return
		}
		store.Lock()
		defer store.Unlock()

		event, exists := store.Events[id]
		if !exists {
			c.JSON(404, gin.H{"error": "Not found"})
			return
		}
		if event.CreatorID != creatorID {
			c.JSON(403, gin.H{"error": "Only creator can invite"})
			return
		}

		var targetUserID, targetUsername string
		for _, u := range store.Users {
			if u.Username == input.Username {
				targetUserID = u.ID
				targetUsername = u.Username
				break
			}
		}
		if targetUserID == "" {
			c.JSON(200, gin.H{"message": "Invite processed"})
			return
		}
		for _, p := range event.Participants {
			if p == targetUserID {
				c.JSON(409, gin.H{"error": "User already in event"})
				return
			}
		}

		event.Participants = append(event.Participants, targetUserID)

		parts := normalizeParts(event.Data["participants"])
		newParticipant := map[string]interface{}{
			"id":           targetUserID,
			"name":         targetUsername,
			"availability": map[string]bool{},
		}
		event.Data["participants"] = append(parts, newParticipant)
		event.Data["creatorId"] = event.CreatorID

		store.Events[id] = event
		saveToDisk("events.json", store.Events)

		go sseHub.broadcast(id, mustJSON(event.Data))
		c.JSON(200, gin.H{"message": "Invited"})
	})

	auth.POST("/events/:id/join", func(c *gin.Context) {
		id := c.Param("id")
		userID := ctxUserID(c)
		if userID == "" {
			c.JSON(401, gin.H{"error": "Login required"})
			return
		}

		store.Lock()
		defer store.Unlock()
		event, exists := store.Events[id]
		if !exists {
			c.JSON(404, gin.H{"error": "Not found"})
			return
		}
		for _, p := range event.Participants {
			if p == userID {
				c.JSON(200, gin.H{"message": "Already joined"})
				return
			}
		}

		event.Participants = append(event.Participants, userID)

		var myUsername string
		for _, u := range store.Users {
			if u.ID == userID {
				myUsername = u.Username
				break
			}
		}

		parts := normalizeParts(event.Data["participants"])
		newParticipant := map[string]interface{}{
			"id":           userID,
			"name":         myUsername,
			"availability": map[string]bool{},
		}
		event.Data["participants"] = append(parts, newParticipant)
		event.Data["creatorId"] = event.CreatorID

		store.Events[id] = event
		saveToDisk("events.json", store.Events)

		go sseHub.broadcast(id, mustJSON(event.Data))
		c.JSON(200, gin.H{"message": "Joined"})
	})

	auth.POST("/events/:id/leave", func(c *gin.Context) {
		id := c.Param("id")
		userID := ctxUserID(c)
		store.Lock()
		defer store.Unlock()
		event, exists := store.Events[id]
		if !exists {
			c.JSON(404, gin.H{"error": "Not found"})
			return
		}

		newParticipants := []string{}
		found := false
		for _, p := range event.Participants {
			if p == userID {
				found = true
			} else {
				newParticipants = append(newParticipants, p)
			}
		}
		if !found {
			c.JSON(400, gin.H{"error": "Not in event"})
			return
		}
		event.Participants = newParticipants

		if parts, ok := event.Data["participants"].([]interface{}); ok {
			newPartsJSON := []interface{}{}
			for _, p := range parts {
				if pMap, ok := p.(map[string]interface{}); ok {
					if pMap["id"] != userID {
						newPartsJSON = append(newPartsJSON, p)
					}
				}
			}
			event.Data["participants"] = newPartsJSON
		}
		event.Data["creatorId"] = event.CreatorID

		store.Events[id] = event
		saveToDisk("events.json", store.Events)

		go sseHub.broadcast(id, mustJSON(event.Data))
		c.JSON(200, gin.H{"message": "Left event"})
	})

	auth.GET("/my-events", func(c *gin.Context) {
		userID := ctxUserID(c)
		if userID == "" {
			c.JSON(401, gin.H{"error": "Unauthorized"})
			return
		}

		myEvents := []interface{}{}
		store.RLock()
		for _, event := range store.Events {
			isParticipant := false
			for _, p := range event.Participants {
				if p == userID {
					isParticipant = true
				}
			}
			if event.CreatorID == userID || isParticipant {
				ed := make(map[string]interface{})
				for k, v := range event.Data {
					ed[k] = v
				}
				ed["isOwner"] = (event.CreatorID == userID)
				ed["creatorId"] = event.CreatorID
				myEvents = append(myEvents, ed)
			}
		}
		store.RUnlock()
		c.JSON(200, myEvents)
	})

	log.Println("Server running on http://localhost:8080")
	r.Run(":8080")
}

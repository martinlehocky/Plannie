package main

import (
	"encoding/json"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/time/rate"
)

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

func saveToDisk(filename string, data interface{}) {
	file, _ := json.MarshalIndent(data, "", "  ")
	_ = ioutil.WriteFile(filename, file, 0644)
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

// --- MAIN ---
func main() {
	loadFromDisk()
	go cleanupVisitors()

	r := gin.Default()

	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:3000"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Authorization"}
	r.Use(cors.New(config))
	r.Use(rateLimitMiddleware())

	// --- SSE subscribe ---
	r.GET("/events/:id/stream", func(c *gin.Context) {
		id := c.Param("id")
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
				c.JSON(400, gin.H{"error": "Username taken"})
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
					c.JSON(200, gin.H{"token": u.ID, "username": u.Username})
					return
				}
			}
		}
		c.JSON(401, gin.H{"error": "Invalid credentials"})
	})

	r.PUT("/users/me", func(c *gin.Context) {
		userID := c.GetHeader("Authorization")
		if userID == "" {
			c.JSON(401, gin.H{"error": "Unauthorized"})
			return
		}

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

		nameChanged := false
		if input.Username != "" && input.Username != user.Username {
			for _, u := range store.Users {
				if u.Username == input.Username {
					c.JSON(400, gin.H{"error": "Username taken"})
					return
				}
			}
			user.Username = input.Username
			nameChanged = true
		}

		if input.NewPassword != "" {
			if input.OldPassword == "" {
				c.JSON(400, gin.H{"error": "Current password required to set new password"})
				return
			}
			if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.OldPassword)); err != nil {
				c.JSON(401, gin.H{"error": "Current password incorrect"})
				return
			}
			hashed, _ := bcrypt.GenerateFromPassword([]byte(input.NewPassword), 10)
			user.Password = string(hashed)
		}

		store.Users[userID] = user
		saveToDisk("users.json", store.Users)

		if nameChanged {
			for id, event := range store.Events {
				updated := false
				if parts, ok := event.Data["participants"].([]interface{}); ok {
					newParts := []interface{}{}
					for _, p := range parts {
						if pMap, ok := p.(map[string]interface{}); ok {
							if pMap["id"] == userID {
								pMap["name"] = user.Username
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

		c.JSON(200, gin.H{"username": user.Username})
	})

	// --- EVENTS ---
	r.POST("/events", func(c *gin.Context) {
		var input map[string]interface{}
		if err := c.BindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": "Invalid JSON"})
			return
		}

		creatorID := c.GetHeader("Authorization")
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

	// Updated: enforce auth and creator-only disabledSlots updates; preserve disabledSlots for non-creators
	r.PUT("/events/:id", func(c *gin.Context) {
		id := c.Param("id")
		userID := c.GetHeader("Authorization")
		if userID == "" {
			c.JSON(401, gin.H{"error": "Unauthorized"})
			return
		}

		var input map[string]interface{}
		if err := c.BindJSON(&input); err != nil {
			c.JSON(400, gin.H{"error": "Invalid JSON"})
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

		if ds, present := input["disabledSlots"]; present {
			if !isCreator {
				c.JSON(403, gin.H{"error": "Only creator can change disabled slots"})
				return
			}
			event.Data["disabledSlots"] = ds
		} else {
			if existing := event.Data["disabledSlots"]; existing != nil {
				input["disabledSlots"] = existing
			}
		}

		event.Data = input

		if parts, ok := input["participants"].([]interface{}); ok {
			newParts := []string{}
			for _, p := range parts {
				if pMap, ok := p.(map[string]interface{}); ok {
					if pid, ok := pMap["id"].(string); ok {
						newParts = append(newParts, pid)
					}
				}
			}
			event.Participants = newParts
		}

		store.Events[id] = event
		saveToDisk("events.json", store.Events)

		go sseHub.broadcast(id, mustJSON(input))
		c.JSON(200, input)
	})

	r.DELETE("/events/:id", func(c *gin.Context) {
		id := c.Param("id")
		userID := c.GetHeader("Authorization")
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
	r.POST("/events/:id/invite", func(c *gin.Context) {
		id := c.Param("id")
		creatorID := c.GetHeader("Authorization")
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
			c.JSON(404, gin.H{"error": "User not found"})
			return
		}
		for _, p := range event.Participants {
			if p == targetUserID {
				c.JSON(409, gin.H{"error": "User already in event"})
				return
			}
		}

		event.Participants = append(event.Participants, targetUserID)
		if parts, ok := event.Data["participants"].([]interface{}); ok {
			newParticipant := map[string]interface{}{
				"id":           targetUserID,
				"name":         targetUsername,
				"availability": map[string]bool{},
			}
			event.Data["participants"] = append(parts, newParticipant)
		}

		store.Events[id] = event
		saveToDisk("events.json", store.Events)

		go sseHub.broadcast(id, mustJSON(event.Data))
		c.JSON(200, gin.H{"message": "Invited"})
	})

	r.POST("/events/:id/join", func(c *gin.Context) {
		id := c.Param("id")
		userID := c.GetHeader("Authorization")
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

		if parts, ok := event.Data["participants"].([]interface{}); ok {
			newParticipant := map[string]interface{}{
				"id":           userID,
				"name":         myUsername,
				"availability": map[string]bool{},
			}
			event.Data["participants"] = append(parts, newParticipant)
		}

		store.Events[id] = event
		saveToDisk("events.json", store.Events)

		go sseHub.broadcast(id, mustJSON(event.Data))
		c.JSON(200, gin.H{"message": "Joined"})
	})

	r.POST("/events/:id/leave", func(c *gin.Context) {
		id := c.Param("id")
		userID := c.GetHeader("Authorization")
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

		store.Events[id] = event
		saveToDisk("events.json", store.Events)

		go sseHub.broadcast(id, mustJSON(event.Data))
		c.JSON(200, gin.H{"message": "Left event"})
	})

	r.GET("/my-events", func(c *gin.Context) {
		userID := c.GetHeader("Authorization")
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
				myEvents = append(myEvents, ed)
			}
		}
		store.RUnlock()
		c.JSON(200, myEvents)
	})

	log.Println("Server running on http://localhost:8080")
	r.Run(":8080")
}

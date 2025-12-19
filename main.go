package main

import (
	"encoding/json"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"sync"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// EventStore handles thread-safe access to our data
type EventStore struct {
	sync.RWMutex
	Events map[string]interface{}
	File   string
}

// Load reads the JSON file into memory
func (s *EventStore) Load() {
	s.Lock()
	defer s.Unlock()

	file, err := ioutil.ReadFile(s.File)
	if err != nil {
		if os.IsNotExist(err) {
			s.Events = make(map[string]interface{}) // Start fresh if file doesn't exist
			return
		}
		log.Fatal("Failed to load events:", err)
	}

	json.Unmarshal(file, &s.Events)
}

// Save writes the memory map back to the JSON file
func (s *EventStore) Save() {
	s.Lock()
	defer s.Unlock()

	data, err := json.MarshalIndent(s.Events, "", "  ")
	if err != nil {
		log.Println("Error marshalling data:", err)
		return
	}

	err = ioutil.WriteFile(s.File, data, 0644)
	if err != nil {
		log.Println("Error writing file:", err)
	}
}

// Global store instance
var store = EventStore{File: "events.json"}

func main() {
	// 1. Initialize Store
	store.Load()
	log.Println("Loaded", len(store.Events), "events from disk")

	// 2. Setup Router
	r := gin.Default()

	// 3. Configure CORS (Allows your Next.js frontend to connect)
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:3000"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type"}
	r.Use(cors.New(config))

	// --- API ENDPOINTS ---

	// POST /events - Create a new event
	r.POST("/events", func(c *gin.Context) {
		var eventData map[string]interface{}
		if err := c.BindJSON(&eventData); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
			return
		}

		id, ok := eventData["id"].(string)
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ID is required"})
			return
		}

		// Save to memory and disk
		store.Lock()
		store.Events[id] = eventData
		store.Unlock()
		store.Save()

		c.JSON(http.StatusCreated, eventData)
	})

	// GET /events/:id - Retrieve an event
	r.GET("/events/:id", func(c *gin.Context) {
		id := c.Param("id")

		store.RLock()
		eventData, exists := store.Events[id]
		store.RUnlock()

		if !exists {
			c.JSON(http.StatusNotFound, gin.H{"error": "Event not found"})
			return
		}

		c.JSON(http.StatusOK, eventData)
	})

	// PUT /events/:id - Update an event
	r.PUT("/events/:id", func(c *gin.Context) {
		id := c.Param("id")
		var eventData map[string]interface{}

		if err := c.BindJSON(&eventData); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
			return
		}

		store.Lock()
		store.Events[id] = eventData
		store.Unlock()
		store.Save()

		c.JSON(http.StatusOK, eventData)
	})

	log.Println("Server running on http://localhost:8080")
	r.Run(":8080")
}

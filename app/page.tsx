"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Clock } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import type { DateRange } from "react-day-picker"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

export default function Home() {
  const router = useRouter()
  const { toast } = useToast()

  const [eventName, setEventName] = useState("")
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [duration, setDuration] = useState("30")
  const [customDuration, setCustomDuration] = useState("") // New State
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Check login status on mount
  useEffect(() => {
    const userId = localStorage.getItem("userId")
    setIsLoggedIn(!!userId)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("userId")
    localStorage.removeItem("username")
    setIsLoggedIn(false)
    toast({ title: "Signed Out", description: "See you next time!" })
  }

  const handleCreateEvent = async () => {
    if (!eventName || !dateRange?.from || !dateRange?.to) return

    // Calculate final duration
    let finalDuration = Number.parseInt(duration)
    if (duration === "custom") {
      finalDuration = Number.parseInt(customDuration)
      if (isNaN(finalDuration) || finalDuration <= 0) {
        toast({ title: "Invalid Duration", description: "Please enter a valid number of minutes.", variant: "destructive" })
        return
      }
    }

    setIsSubmitting(true)

    const eventId = Math.random().toString(36).substring(7)
    const userId = localStorage.getItem("userId") || ""

    const eventData = {
      id: eventId,
      name: eventName,
      dateRange: {
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
      },
      duration: finalDuration,
      timezone,
      participants: [],
    }

    try {
      const response = await fetch('http://localhost:8080/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': userId // Send User ID to backend
        },
        body: JSON.stringify(eventData),
      })

      if (!response.ok) {
        throw new Error('Failed to create event')
      }

      router.push(`/event/${eventId}`)
    } catch (error) {
      console.error("Error creating event:", error)
      toast({
        title: "Error",
        description: "Could not create event. Ensure backend is running.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
      <div className="min-h-screen bg-background flex flex-col md:justify-center relative">
        {/* Top Bar - Static flow on mobile, Absolute on Desktop */}
        <div className="w-full flex justify-end items-center gap-2 p-4 md:absolute md:top-8 md:right-8 md:p-0 z-50">
          {isLoggedIn ? (
              <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="md:h-10 md:px-4 md:py-2 text-xs md:text-sm"
                    onClick={() => router.push("/dashboard")}
                >
                  My Dashboard
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="md:h-10 md:px-4 md:py-2 text-xs md:text-sm"
                    onClick={handleLogout}
                >
                  Sign Out
                </Button>
              </div>
          ) : (
              <Button
                  variant="ghost"
                  size="sm"
                  className="md:h-10 md:px-4 md:py-2 text-xs md:text-sm"
                  onClick={() => router.push("/login")}
              >
                Sign In / Register
              </Button>
          )}
          <ThemeToggle />
        </div>

        {/* Main Content Wrapper - Centered in remaining space */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 w-full">
          <div className="w-full max-w-4xl grid gap-8">
            <div className="text-center space-y-2">
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight lg:text-7xl">Find the Perfect Time</h1>
              <p className="text-xl text-muted-foreground md:text-2xl">Modern group scheduling made simple</p>
            </div>

            <Card className="border-2 shadow-lg">
              <CardHeader>
                <CardTitle>Create New Event</CardTitle>
                <CardDescription>Set up your event details and select available dates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="eventName">Event Name</Label>
                      <Input
                          id="eventName"
                          placeholder="e.g., Team Standup, Birthday Party"
                          value={eventName}
                          onChange={(e) => setEventName(e.target.value)}
                          className="text-base md:text-lg h-11 md:h-12"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Duration</Label>
                        <Select value={duration} onValueChange={setDuration}>
                          <SelectTrigger className="h-11 md:h-12">
                            <Clock className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Duration" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15">15 minutes</SelectItem>
                            <SelectItem value="30">30 minutes</SelectItem>
                            <SelectItem value="60">1 hour</SelectItem>
                            <SelectItem value="90">1.5 hours</SelectItem>
                            <SelectItem value="120">2 hours</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem> {/* New Option */}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Time Zone</Label>
                        <Input
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                            className="h-11 md:h-12"
                            disabled
                        />
                      </div>
                    </div>

                    {/* Custom Duration Input Field */}
                    {duration === "custom" && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                          <Label>Custom Duration (minutes)</Label>
                          <Input
                              type="number"
                              placeholder="e.g. 45"
                              value={customDuration}
                              onChange={(e) => setCustomDuration(e.target.value)}
                              className="h-11 md:h-12"
                          />
                        </div>
                    )}

                  </div>

                  <div className="space-y-2">
                    <Label>Select Date Range</Label>
                    <div className="border rounded-md p-4 flex justify-center bg-card">
                      <Calendar
                          mode="range"
                          selected={dateRange}
                          onSelect={setDateRange}
                          className="rounded-md"
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      />
                    </div>
                    {dateRange?.from && dateRange?.to && (
                        <p className="text-sm text-muted-foreground text-center">
                          Selected: {format(dateRange.from, "MMM dd, yyyy")} - {format(dateRange.to, "MMM dd, yyyy")}
                        </p>
                    )}
                  </div>
                </div>

                <Button
                    size="lg"
                    className="w-full text-lg h-12 md:h-14"
                    onClick={handleCreateEvent}
                    disabled={!eventName || !dateRange?.from || !dateRange?.to || isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Create Event"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
  )
}

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon, Clock } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import type { DateRange } from "react-day-picker"
import { format } from "date-fns"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()
  const [eventName, setEventName] = useState("")
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [duration, setDuration] = useState("30")
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreateEvent = async () => {
    if (!eventName || !dateRange?.from || !dateRange?.to) {
      return
    }

    setIsSubmitting(true)

    // Generate a unique event ID
    const eventId = Math.random().toString(36).substring(7)

    const eventData = {
      id: eventId,
      name: eventName,
      dateRange: {
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
      },
      duration: Number.parseInt(duration),
      timezone,
      participants: [],
    }

    try {
      // Replaces: localStorage.setItem(`event-${eventId}`, JSON.stringify(eventData))
      const response = await fetch('http://localhost:8080/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      })

      if (!response.ok) {
        throw new Error('Failed to create event')
      }

      router.push(`/event/${eventId}`)
    } catch (error) {
      console.error("Error creating event:", error)
      alert("Could not create event. Please ensure the backend is running.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 md:p-8 relative">
        <div className="absolute top-4 right-4 md:top-8 md:right-8">
          <ThemeToggle />
        </div>

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

          <p className="text-center text-muted-foreground text-sm">
            No sign-up required. Share the link with your group to get started.
          </p>
        </div>
      </div>
  )
}

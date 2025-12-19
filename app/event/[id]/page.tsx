"use client"

import { use, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { AvailabilityGrid } from "@/components/availability-grid"
import { Share2, Users, Calendar, Trophy } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { format } from "date-fns"

type Participant = {
  id: string
  name: string
  availability: Record<string, boolean>
}

type EventData = {
  id: string
  name: string
  dateRange: {
    from: string
    to: string
  }
  duration: number
  timezone: string
  participants: Participant[]
}

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { toast } = useToast()
  const [eventData, setEventData] = useState<EventData | null>(null)
  const [participantName, setParticipantName] = useState("")
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null)
  const [showSignIn, setShowSignIn] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await fetch(`http://localhost:8080/events/${id}`)
        if (res.ok) {
          const data = await res.json()
          setEventData(data)
        } else {
          setEventData(null)
        }
      } catch (error) {
        console.error("Failed to fetch event", error)
      } finally {
        setLoading(false)
      }
    }

    fetchEvent()
  }, [id])

  const handleSignIn = () => {
    if (!participantName || !eventData) return

    const existingParticipant = eventData.participants.find((p) => p.name === participantName)

    if (existingParticipant) {
      setCurrentParticipant(existingParticipant)
    } else {
      const newParticipant: Participant = {
        id: Math.random().toString(36).substring(7),
        name: participantName,
        availability: {},
      }
      setCurrentParticipant(newParticipant)
    }
    setShowSignIn(false)
  }

  const handleSaveAvailability = async (availability: Record<string, boolean>) => {
    if (!eventData || !currentParticipant) return

    const updatedParticipant = { ...currentParticipant, availability }
    const updatedParticipants = eventData.participants.filter((p) => p.id !== currentParticipant.id)
    updatedParticipants.push(updatedParticipant)

    const updatedEvent = { ...eventData, participants: updatedParticipants }

    try {
      const res = await fetch(`http://localhost:8080/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedEvent),
      })

      if (res.ok) {
        setEventData(updatedEvent)
        // Also update local currentParticipant so if they edit again, they have latest state
        setCurrentParticipant(updatedParticipant)
        toast({
          title: "Availability Saved",
          description: "Your availability has been updated successfully.",
        })
      } else {
        throw new Error("Backend save failed")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save availability. Check connection.",
        variant: "destructive",
      })
    }
  }

  const handleShare = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    toast({
      title: "Link Copied!",
      description: "Share this link with your group.",
    })
  }

  const getBestTimes = () => {
    if (!eventData) return []
    const allSlots: Record<string, string[]> = {}

    eventData.participants.forEach((participant) => {
      Object.entries(participant.availability).forEach(([slot, isAvailable]) => {
        if (isAvailable) {
          if (!allSlots[slot]) allSlots[slot] = []
          allSlots[slot].push(participant.name)
        }
      })
    })

    return Object.entries(allSlots)
        .map(([slot, names]) => ({ slot, count: names.length, names }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading event...</div>
  }

  if (!eventData) {
    return (
        <div className="flex h-screen items-center justify-center">
          <Card className="w-[350px]">
            <CardHeader>
              <CardTitle>Event not found</CardTitle>
            </CardHeader>
            <CardContent>
              <p>The event you are looking for does not exist or has been removed.</p>
              <Button className="w-full mt-4" onClick={() => (window.location.href = "/")}>
                Create New Event
              </Button>
            </CardContent>
          </Card>
        </div>
    )
  }

  const bestTimes = getBestTimes()

  return (
      <div className="min-h-screen bg-background p-4 md:p-8 relative">
        <div className="absolute top-4 right-4 md:top-8 md:right-8">
          <ThemeToggle />
        </div>

        <div className="max-w-7xl mx-auto grid gap-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">{eventData.name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground mt-2">
                <Calendar className="h-4 w-4" />
                <span>
                {format(new Date(eventData.dateRange.from), "MMM d")} -{" "}
                  {format(new Date(eventData.dateRange.to), "MMM d, yyyy")}
              </span>
              </div>
            </div>
            <Button onClick={handleShare} variant="outline" className="gap-2">
              <Share2 className="h-4 w-4" />
              Share Event
            </Button>
          </div>

          <div className="grid lg:grid-cols-[350px_1fr] gap-8">
            {/* Sidebar */}
            <div className="space-y-6">
              {/* Sign In Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Your Identity</CardTitle>
                </CardHeader>
                <CardContent>
                  {showSignIn ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Sign In</Label>
                          <Input
                              id="name"
                              placeholder="Your Name"
                              value={participantName}
                              onChange={(e) => setParticipantName(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                              className="h-10 md:h-11"
                          />
                        </div>
                        <Button className="w-full" onClick={handleSignIn} disabled={!participantName}>
                          Continue
                        </Button>
                      </div>
                  ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{currentParticipant?.name.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="font-medium">
                            <p className="text-sm text-muted-foreground">Signed in as</p>
                            <p>{currentParticipant?.name}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setShowSignIn(true)}>
                          Switch user
                        </Button>
                      </div>
                  )}
                </CardContent>
              </Card>

              {/* Best Times */}
              {bestTimes.length > 0 && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg text-primary">
                        <Trophy className="h-5 w-5" />
                        Best Times
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {bestTimes.map((time, index) => (
                          <div key={time.slot} className="flex items-start justify-between gap-4 p-3 rounded-lg bg-background border">
                            <div>
                              <div className="font-semibold text-primary">
                                {format(new Date(time.slot.split("-").slice(0, 3).join("-") + "T" + time.slot.split("-")[3]), "MMM d, h:mm a")}
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">{time.names.join(", ")}</div>
                            </div>
                            <Badge variant={index === 0 ? "default" : "secondary"}>
                              {time.count}/{eventData.participants.length} available
                            </Badge>
                          </div>
                      ))}
                    </CardContent>
                  </Card>
              )}

              {/* Participants List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5" />
                    Participants ({eventData.participants.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {eventData.participants.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No participants yet</p>
                    ) : (
                        eventData.participants.map((participant) => (
                            <Badge key={participant.id} variant="secondary" className="px-3 py-1 text-sm">
                              <Avatar className="h-4 w-4 mr-2">
                                <AvatarFallback className="text-[10px]">
                                  {participant.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {participant.name}
                            </Badge>
                        ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Availability Grid */}
            <div className="space-y-6">
              {!showSignIn && currentParticipant ? (
                  <AvailabilityGrid
                      dateRange={{
                        from: new Date(eventData.dateRange.from),
                        to: new Date(eventData.dateRange.to),
                      }}
                      duration={eventData.duration}
                      currentParticipant={currentParticipant}
                      allParticipants={eventData.participants}
                      onSave={handleSaveAvailability}
                  />
              ) : (
                  <Card className="h-full flex items-center justify-center min-h-[400px] border-dashed">
                    <div className="text-center space-y-2">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
                      <h3 className="text-lg font-semibold">Sign in to mark your availability</h3>
                      <p className="text-muted-foreground">Enter your name in the sidebar to get started</p>
                    </div>
                  </Card>
              )}
            </div>
          </div>
        </div>
      </div>
  )
}

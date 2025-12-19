"use client"

import { use, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { AvailabilityGrid } from "@/components/availability-grid"
import { Share2, Users, Calendar, Trophy, LogIn, Trash2, UserPlus, Globe } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

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
  creatorId?: string
}

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { toast } = useToast()
  const router = useRouter()
  const [eventData, setEventData] = useState<EventData | null>(null)
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isCreator, setIsCreator] = useState(false)
  const [isParticipant, setIsParticipant] = useState(false)

  const [userTimezone, setUserTimezone] = useState("")
  const [inviteUsername, setInviteUsername] = useState("")

  const fetchEventData = async () => {
    const userId = localStorage.getItem("userId")
    const username = localStorage.getItem("username")
    setIsLoggedIn(!!userId)

    const savedTz = localStorage.getItem("preferredTimezone")
    setUserTimezone(savedTz || Intl.DateTimeFormat().resolvedOptions().timeZone)

    try {
      const res = await fetch(`http://localhost:8080/events/${id}`)
      if (res.ok) {
        const data = await res.json()
        setEventData(data)
        if (userId && data.creatorId === userId) setIsCreator(true)

        const existing = data.participants.find((p: any) => p.id === userId)
        if (existing) {
          setIsParticipant(true)
          setCurrentParticipant(existing)
        } else {
          setIsParticipant(false)
          if (userId && username) {
            setCurrentParticipant({ id: userId, name: username, availability: {} })
          }
        }
      } else {
        setEventData(null)
      }
    } catch (error) {
      console.error("Failed to fetch event", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEventData() }, [id])

  const handleSaveAvailability = async (availability: Record<string, boolean>) => {
    if (!eventData || !currentParticipant) return
    const updatedParticipant = { ...currentParticipant, availability }
    const updatedParticipants = eventData.participants.filter((p) => p.id !== currentParticipant.id)
    updatedParticipants.push(updatedParticipant)
    const updatedEvent = { ...eventData, participants: updatedParticipants }
    const userId = localStorage.getItem("userId")

    try {
      const res = await fetch(`http://localhost:8080/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': userId || "" },
        body: JSON.stringify(updatedEvent),
      })
      if (res.ok) {
        setEventData(updatedEvent)
        setCurrentParticipant(updatedParticipant)
        toast({ title: "Availability Saved", description: "Updated successfully." })
      } else {
        toast({ title: "Error", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", variant: "destructive" })
    }
  }

  const handleJoin = async () => {
    const userId = localStorage.getItem("userId")
    const res = await fetch(`http://localhost:8080/events/${id}/join`, {
      method: "POST", headers: { "Authorization": userId || "" }
    })
    if (res.ok) {
      toast({ title: "Joined!", description: "You can now mark your availability." })
      await fetchEventData()
    } else {
      const d = await res.json()
      toast({ title: "Error", description: d.error, variant: "destructive" })
    }
  }

  const handleLeave = async () => {
    const userId = localStorage.getItem("userId")
    const res = await fetch(`http://localhost:8080/events/${id}/leave`, {
      method: "POST", headers: { "Authorization": userId || "" }
    })
    if (res.ok) { router.push("/dashboard"); toast({ title: "Left Event" }) }
  }

  const handleDelete = async () => {
    const userId = localStorage.getItem("userId")
    const res = await fetch(`http://localhost:8080/events/${id}`, {
      method: "DELETE", headers: { "Authorization": userId || "" }
    })
    if (res.ok) { router.push("/dashboard"); toast({ title: "Event Deleted" }) }
  }

  const handleInvite = async () => {
    if (!inviteUsername) return
    const userId = localStorage.getItem("userId")
    const res = await fetch(`http://localhost:8080/events/${id}/invite`, {
      method: "POST", headers: { "Authorization": userId || "", "Content-Type": "application/json" },
      body: JSON.stringify({ username: inviteUsername })
    })
    if (res.ok) {
      toast({ title: "Invited!" }); setInviteUsername(""); fetchEventData()
    }
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    toast({ title: "Link Copied!" })
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

  // --- FIXED FORMATTING FUNCTION ---
  const formatTimeInTz = (slotKey: string) => {
    try {
      // 1. Try parsing as new ISO format (e.g. "2023-10-25T14:00:00.000Z")
      const date = new Date(slotKey)

      // Check if valid date
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString([], {
          timeZone: userTimezone,
          weekday: 'short',
          hour: 'numeric',
          minute: '2-digit',
          month: 'short',
          day: 'numeric'
        })
      }

      // 2. Fallback for old format "yyyy-MM-dd-HH:mm"
      const [y, m, d, h, min] = slotKey.split(/[-:]/).map(Number)
      const fallbackDate = new Date(y, m - 1, d, h, min)

      return fallbackDate.toLocaleTimeString([], {
        timeZone: userTimezone,
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        month: 'short',
        day: 'numeric'
      })

    } catch (e) {
      return slotKey // Return raw string if all else fails
    }
  }

  if (loading) return <div>Loading...</div>
  if (!eventData) return <div>Event not found</div>

  const bestTimes = getBestTimes()

  return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="mx-auto max-w-6xl space-y-6">

          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{eventData.name}</h1>
              <div className="flex items-center gap-4 text-muted-foreground mt-2">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>
                  {format(new Date(eventData.dateRange.from), "MMM d")} -{" "}
                    {format(new Date(eventData.dateRange.to), "MMM d, yyyy")}
                </span>
                </div>
                <div className="flex items-center gap-1">
                  <Globe className="h-4 w-4" />
                  <span className="capitalize">{userTimezone.replace(/_/g, " ")}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => router.push("/dashboard")}>Dashboard</Button>
              {isParticipant && !isCreator && (
                  <Button variant="destructive" onClick={handleLeave}>Leave</Button>
              )}
              <Button variant="outline" onClick={handleShare}>
                <Share2 className="mr-2 h-4 w-4" /> Share
              </Button>
              {isCreator && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive"><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Event?</AlertDialogTitle>
                        <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            {/* Main Grid Area */}
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  {isLoggedIn && currentParticipant ? (
                      <AvailabilityGrid
                          dateRange={{
                            from: new Date(eventData.dateRange.from),
                            to: new Date(eventData.dateRange.to)
                          }}
                          duration={30}
                          currentParticipant={currentParticipant}
                          allParticipants={eventData.participants}
                          onSave={handleSaveAvailability}
                          timezone={userTimezone}
                      />
                  ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <LogIn className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold">Please Sign In</h3>
                        <p className="text-muted-foreground mb-4">You must be logged in to participate.</p>
                        <Button onClick={() => router.push("/login")}>Sign In Now</Button>
                      </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Best Times */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Trophy className="h-5 w-5 text-yellow-500" /> Best Times
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {bestTimes.length > 0 ? (
                      bestTimes.map((time, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded border bg-card">
                            <div className="text-sm">
                              <div className="font-medium text-green-600">{formatTimeInTz(time.slot)}</div>
                              <div className="text-xs text-muted-foreground">{time.names.join(", ")}</div>
                            </div>
                            <Badge variant="secondary">{time.count}/{eventData.participants.length}</Badge>
                          </div>
                      ))
                  ) : (
                      <div className="text-sm text-muted-foreground">No overlapping times yet.</div>
                  )}
                </CardContent>
              </Card>

              {/* Participants */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5" /> Participants
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {eventData.participants.map((p) => (
                      <div key={p.id} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{p.name[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{p.name}</span>
                      </div>
                  ))}
                  {!isLoggedIn && (
                      <Button className="w-full mt-2" onClick={() => router.push("/login")}>Sign In to Join</Button>
                  )}
                  {isLoggedIn && !isParticipant && (
                      <Button className="w-full mt-2" onClick={handleJoin}>Join Event</Button>
                  )}
                </CardContent>
              </Card>

              {/* Invite */}
              {isCreator && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <UserPlus className="h-5 w-5" /> Invite
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Input
                            placeholder="Username"
                            value={inviteUsername}
                            onChange={(e) => setInviteUsername(e.target.value)}
                        />
                        <Button onClick={handleInvite}>Add</Button>
                      </div>
                    </CardContent>
                  </Card>
              )}

              {/* Identity */}
              {isLoggedIn && currentParticipant && (
                  <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/20">
                    <Avatar>
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {currentParticipant.name[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-xs text-muted-foreground">Signed in as</div>
                      <div className="font-semibold">{currentParticipant.name}</div>
                    </div>
                  </div>
              )}
            </div>
          </div>
        </div>
      </div>
  )
}

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

  // State for user preferences
  const [userTimezone, setUserTimezone] = useState("")

  const [inviteUsername, setInviteUsername] = useState("")

  const fetchEventData = async () => {
    const userId = localStorage.getItem("userId")
    const username = localStorage.getItem("username")
    setIsLoggedIn(!!userId)

    // Load timezone preference (or default to system)
    const savedTz = localStorage.getItem("preferredTimezone")
    setUserTimezone(savedTz || Intl.DateTimeFormat().resolvedOptions().timeZone)

    try {
      const res = await fetch(`http://localhost:8080/events/${id}`)
      if (res.ok) {
        const data = await res.json()
        setEventData(data)

        if (userId && data.creatorId === userId) {
          setIsCreator(true)
        }

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

  useEffect(() => {
    fetchEventData()
  }, [id])

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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': userId || ""
        },
        body: JSON.stringify(updatedEvent),
      })
      if (res.ok) {
        setEventData(updatedEvent)
        setCurrentParticipant(updatedParticipant)
        toast({ title: "Availability Saved", description: "Updated successfully." })
      }
    } catch (error) {
      toast({ title: "Error", variant: "destructive" })
    }
  }

  const handleJoin = async () => {
    const userId = localStorage.getItem("userId")
    try {
      const res = await fetch(`http://localhost:8080/events/${id}/join`, {
        method: "POST",
        headers: { "Authorization": userId || "" }
      })
      if (res.ok) {
        toast({ title: "Joined!", description: "You can now mark your availability." })
        await fetchEventData()
      } else {
        const d = await res.json()
        toast({ title: "Error", description: d.error || "Could not join.", variant: "destructive" })
      }
    } catch (e) {
      console.error(e)
      toast({ title: "Connection Error", variant: "destructive" })
    }
  }

  const handleLeave = async () => {
    const userId = localStorage.getItem("userId")
    const res = await fetch(`http://localhost:8080/events/${id}/leave`, {
      method: "POST",
      headers: { "Authorization": userId || "" }
    })
    if (res.ok) {
      toast({ title: "Left Event", description: "You have been removed." })
      router.push("/dashboard")
    }
  }

  const handleDelete = async () => {
    try {
      const userId = localStorage.getItem("userId")
      const res = await fetch(`http://localhost:8080/events/${id}`, {
        method: "DELETE",
        headers: { "Authorization": userId || "" }
      })
      if (res.ok) {
        toast({ title: "Event Deleted" })
        router.push("/dashboard")
      } else {
        toast({ title: "Error", description: "Only the creator can delete this.", variant: "destructive" })
      }
    } catch (e) { console.error(e) }
  }

  const handleInvite = async () => {
    if (!inviteUsername) return
    const userId = localStorage.getItem("userId")
    const res = await fetch(`http://localhost:8080/events/${id}/invite`, {
      method: "POST",
      headers: { "Authorization": userId || "", "Content-Type": "application/json" },
      body: JSON.stringify({ username: inviteUsername })
    })
    if (res.ok) {
      toast({ title: "Invited!", description: `${inviteUsername} has been added.` })
      setInviteUsername("")
      fetchEventData()
    } else {
      const d = await res.json()
      toast({ title: "Error", description: d.error, variant: "destructive" })
    }
  }

  const handleShare = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    toast({ title: "Link Copied!", description: "Share this link with your group." })
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

  // Format helper for display
  const formatTimeInTz = (dateString: string) => {
    try {
      // Parse the slot string (yyyy-MM-dd-HH:mm) back to date
      // NOTE: Slot strings are stored in local key format.
      // We construct a date object from it, then display it in the user's TZ.
      const [y, m, d, h, min] = dateString.split(/[-:]/).map(Number)
      // Construct date in LOCAL system time (which matches how slots were generated)
      const date = new Date(y, m - 1, d, h, min)
      return date.toLocaleTimeString([], {
        timeZone: userTimezone,
        hour: 'numeric',
        minute: '2-digit',
        month: 'short',
        day: 'numeric'
      })
    } catch (e) {
      return dateString
    }
  }

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>
  if (!eventData) return <div>Event not found</div>

  const bestTimes = getBestTimes()

  return (
      <div className="min-h-screen bg-background p-4 md:p-8 relative">
        <div className="absolute top-4 right-4 md:top-8 md:right-8">
          <ThemeToggle />
        </div>

        <div className="max-w-7xl mx-auto grid gap-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">{eventData.name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-muted-foreground mt-2">
                <Calendar className="h-4 w-4" />
                <span>
                {format(new Date(eventData.dateRange.from), "MMM d")} -{" "}
                  {format(new Date(eventData.dateRange.to), "MMM d, yyyy")}
              </span>

                {/* Timezone Indicator */}
                <div className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full text-xs font-medium ml-2">
                  <Globe className="h-3 w-3" />
                  <span>{userTimezone.replace(/_/g, " ")}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push("/dashboard")}>Dashboard</Button>
              {isParticipant && !isCreator && (
                  <Button variant="outline" onClick={handleLeave} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    Leave
                  </Button>
              )}
              <Button onClick={handleShare} className="gap-2">
                <Share2 className="h-4 w-4" /> Share
              </Button>
              {isCreator && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Event?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete this event.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-[350px_1fr] gap-8">
            <div className="space-y-6">
              {isCreator && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><UserPlus className="h-4 w-4"/> Invite User</CardTitle></CardHeader>
                    <CardContent className="flex gap-2">
                      <Input
                          placeholder="Username"
                          value={inviteUsername}
                          onChange={(e) => setInviteUsername(e.target.value)}
                          className="h-9"
                      />
                      <Button size="sm" onClick={handleInvite}>Add</Button>
                    </CardContent>
                  </Card>
              )}

              <Card>
                <CardHeader><CardTitle className="text-lg">Your Identity</CardTitle></CardHeader>
                <CardContent>
                  {isLoggedIn && currentParticipant ? (
                      <div className="flex items-center gap-3">
                        <Avatar><AvatarFallback>{currentParticipant.name.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                        <div>
                          <p className="text-sm text-muted-foreground">Signed in as</p>
                          <p className="font-medium">{currentParticipant.name}</p>
                        </div>
                      </div>
                  ) : (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">You must be logged in to participate.</p>
                        <Button className="w-full gap-2" onClick={() => router.push("/login")}>
                          <LogIn className="h-4 w-4" /> Sign In
                        </Button>
                      </div>
                  )}
                </CardContent>
              </Card>

              {bestTimes.length > 0 && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg text-primary">
                        <Trophy className="h-5 w-5" /> Best Times
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {bestTimes.map((time, index) => (
                          <div key={time.slot} className="flex items-start justify-between gap-4 p-3 rounded-lg bg-background border">
                            <div>
                              {/* Display Best Time in correct timezone */}
                              <div className="font-semibold text-primary">
                                {formatTimeInTz(time.slot)}
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

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5" /> Participants ({eventData.participants.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {eventData.participants.map((participant) => (
                        <Badge key={participant.id} variant="secondary" className="px-3 py-1 text-sm">
                          {participant.name}
                        </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {!isLoggedIn ? (
                  <Card className="h-full flex items-center justify-center min-h-[400px] border-dashed">
                    <div className="text-center space-y-4">
                      <h3 className="text-lg font-semibold">Please Sign In</h3>
                      <Button onClick={() => router.push("/login")}>Sign In Now</Button>
                    </div>
                  </Card>
              ) : isParticipant ? (
                  <AvailabilityGrid
                      dateRange={{
                        from: new Date(eventData.dateRange.from),
                        to: new Date(eventData.dateRange.to),
                      }}
                      duration={eventData.duration}
                      currentParticipant={currentParticipant!}
                      allParticipants={eventData.participants}
                      onSave={handleSaveAvailability}
                      timezone={userTimezone} // Pass preferred timezone
                  />
              ) : (
                  <Card className="h-full flex items-center justify-center min-h-[400px]">
                    <div className="text-center space-y-4">
                      <h3 className="text-2xl font-semibold">You're Invited!</h3>
                      <p className="text-muted-foreground">Join this event to let the group know when you're free.</p>
                      <Button size="lg" onClick={handleJoin} className="w-full max-w-xs">Join Event</Button>
                    </div>
                  </Card>
              )}
            </div>
          </div>
        </div>
      </div>
  )
}

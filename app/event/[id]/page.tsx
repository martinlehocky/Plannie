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

  const formatTimeInTz = (slotKey: string) => {
    try {
      const date = new Date(slotKey)
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
      return slotKey
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  if (!eventData) return <div className="flex items-center justify-center min-h-screen">Event not found</div>

  const bestTimes = getBestTimes()

  return (
      <div className="h-screen overflow-hidden bg-background flex flex-col">
        <div className="mx-auto w-full max-w-7xl flex flex-col h-full">

          {/* Compact Header */}
          <div className="flex items-center justify-between p-4 border-b shrink-0">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-bold">{eventData.name}</h1>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {format(new Date(eventData.dateRange.from), "MMM d")} - {format(new Date(eventData.dateRange.to), "MMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    <span className="capitalize">{userTimezone.replace(/_/g, " ")}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button size="sm" variant="outline" onClick={() => router.push("/dashboard")}>Dashboard</Button>
              {isParticipant && !isCreator && (
                  <Button size="sm" variant="destructive" onClick={handleLeave}>Leave</Button>
              )}
              <Button size="sm" variant="outline" onClick={handleShare}>
                <Share2 className="h-4 w-4" />
              </Button>
              {isCreator && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive"><Trash2 className="h-4 w-4" /></Button>
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

          {/* Main Content - Sidebar LEFT, Grid RIGHT */}
          <div className="flex-1 overflow-hidden p-4">
            <div className="grid gap-4 h-full lg:grid-cols-[260px_1fr]">

              {/* Compact Sidebar - LEFT with scrolling */}
              <div className="overflow-y-auto space-y-2.5 h-full">

                {/* Identity Card - Minimal */}
                {isLoggedIn && currentParticipant && (
                    <Card className="shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                              {currentParticipant.name[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium">You</div>
                            <div className="text-sm font-semibold truncate">{currentParticipant.name}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                )}

                {/* Best Times - Compact */}
                <Card className="shadow-sm">
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <Trophy className="h-3.5 w-3.5 text-yellow-500 shrink-0" /> Best Times
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-1.5">
                    {bestTimes.length > 0 ? (
                        bestTimes.map((time, i) => (
                            <div key={i} className="rounded-md border bg-card/50 p-2 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs font-semibold text-green-600 dark:text-green-400 truncate">
                                  {formatTimeInTz(time.slot)}
                                </div>
                                <Badge variant="secondary" className="shrink-0 text-[10px] h-5 px-1.5">
                                  {time.count}/{eventData.participants.length}
                                </Badge>
                              </div>
                              <div className="text-[10px] text-muted-foreground line-clamp-1">
                                {time.names.join(", ")}
                              </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-xs text-muted-foreground text-center py-3">
                          No overlaps yet
                        </div>
                    )}
                  </CardContent>
                </Card>

                {/* Participants - Compact */}
                <Card className="shadow-sm">
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="flex items-center justify-between text-sm font-semibold">
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 shrink-0" /> Participants
                      </div>
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                        {eventData.participants.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-1.5">
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {eventData.participants.map((p) => (
                          <div key={p.id} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors">
                            <Avatar className="h-6 w-6 shrink-0">
                              <AvatarFallback className="text-[10px] font-semibold">{p.name[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium truncate">{p.name}</span>
                          </div>
                      ))}
                    </div>
                    {!isLoggedIn && (
                        <Button className="w-full mt-1.5" size="sm" variant="outline" onClick={() => router.push("/login")}>
                          <LogIn className="h-3 w-3 mr-1.5" />
                          Sign In
                        </Button>
                    )}
                    {isLoggedIn && !isParticipant && (
                        <Button className="w-full mt-1.5" size="sm" onClick={handleJoin}>
                          Join Event
                        </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Invite - Compact */}
                {isCreator && (
                    <Card className="shadow-sm">
                      <CardHeader className="p-3 pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                          <UserPlus className="h-3.5 w-3.5 shrink-0" /> Invite
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <div className="flex gap-1.5">
                          <Input
                              className="text-xs h-8"
                              placeholder="Username"
                              value={inviteUsername}
                              onChange={(e) => setInviteUsername(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                          />
                          <Button size="sm" onClick={handleInvite} className="shrink-0 h-8 px-3 text-xs">
                            Invite
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                )}
              </div>

              {/* Availability Grid - RIGHT */}
              <Card className="overflow-hidden flex flex-col shadow-sm">
                <CardContent className="p-4 flex-1 overflow-y-auto min-h-0">
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
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <LogIn className="h-10 w-10 text-muted-foreground mb-3" />
                        <h3 className="text-base font-semibold">Please Sign In</h3>
                        <p className="text-sm text-muted-foreground mb-3">You must be logged in to participate.</p>
                        <Button size="sm" onClick={() => router.push("/login")}>Sign In Now</Button>
                      </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
  )
}

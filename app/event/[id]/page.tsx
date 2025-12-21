"use client"

import { use, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { AvailabilityGrid } from "@/components/availability-grid"
import {
  Share2,
  Users,
  Calendar,
  Trophy,
  LogIn,
  Trash2,
  UserPlus,
  Globe,
  ChevronDown,
  ChevronUp,
  Pencil,
  RefreshCw,
  AlertTriangle,
  X,
} from "lucide-react"
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { fetchWithAuth, clearTokens } from "@/lib/api"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"

type Participant = {
  id: string
  name: string
  availability: Record<string, boolean>
}

type EventData = {
  id: string
  name: string
  dateRange: { from: string; to: string }
  duration: number
  timezone: string
  participants: Participant[]
  creatorId?: string
  disabledSlots?: string[]
}

type TokenClaims = { uid?: string; sub?: string; uname?: string; username?: string; userId?: string; id?: string; name?: string }

function decodeToken(token: string | null): TokenClaims {
  if (!token) return {}
  const parts = token.split(".")
  if (parts.length !== 3) return {}
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(json)
  } catch {
    return {}
  }
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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [disableMode, setDisableMode] = useState(false)
  const [resetDisabledLoading, setResetDisabledLoading] = useState(false)
  const [renameLoading, setRenameLoading] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState("")
  const [userTimezone, setUserTimezone] = useState("")
  const [inviteUsername, setInviteUsername] = useState("")
  const [sseConnected, setSseConnected] = useState(false)

  const [draftDirty, setDraftDirty] = useState(false)

  const token = useMemo(() => (typeof window !== "undefined" ? localStorage.getItem("token") : null), [])
  const tokenClaims = useMemo(() => decodeToken(token), [token])
  const userId = tokenClaims.uid || tokenClaims.sub || tokenClaims.userId || tokenClaims.id || null
  const usernameClaim = tokenClaims.uname || tokenClaims.username || tokenClaims.name || null

  const syncUserState = (data: EventData) => {
    const loggedIn = !!token
    setIsLoggedIn(loggedIn)
    setIsCreator(loggedIn && userId !== null && data.creatorId === userId)

    const existing = data.participants.find((p) => p.id === userId)
    if (existing) {
      setIsParticipant(true)
      if (!draftDirty) setCurrentParticipant(existing)
    } else {
      setIsParticipant(false)
      if (loggedIn && userId && !draftDirty) {
        const name = localStorage.getItem("username") || usernameClaim || "You"
        setCurrentParticipant({ id: userId, name, availability: {} })
      } else if (!loggedIn) {
        setCurrentParticipant(null)
      }
    }
  }

  const fetchEventData = async () => {
    if (draftDirty) return
    const savedTz = localStorage.getItem("preferredTimezone")
    setUserTimezone(savedTz || Intl.DateTimeFormat().resolvedOptions().timeZone)

    try {
      const res = await fetch(`${API_BASE}/events/${id}`)
      if (res.ok) {
        const data: EventData = await res.json()
        data.disabledSlots = data.disabledSlots || []
        setEventData(data)
        syncUserState(data)
        setRenameValue(data.name)
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
    const timer = setInterval(fetchEventData, sseConnected ? 60000 : 15000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sseConnected, draftDirty])

  useEffect(() => {
    if (!token) return
    const url = `${API_BASE}/events/${id}/stream?token=${encodeURIComponent(token)}`
    const src = new EventSource(url)
    src.onopen = () => setSseConnected(true)
    src.onerror = () => {
      setSseConnected(false)
      src.close()
    }
    src.onmessage = () => {
      if (!draftDirty) fetchEventData()
    }
    return () => {
      setSseConnected(false)
      src.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token, draftDirty])

  const handleSaveAvailability = async (availability: Record<string, boolean>) => {
    if (!eventData || !currentParticipant) return

    const disabled = eventData.disabledSlots || []
    const cleaned: Record<string, boolean> = {}
    Object.entries(availability).forEach(([k, v]) => {
      if (!disabled.includes(k) && v) cleaned[k] = v
    })

    const updatedParticipant = { ...currentParticipant, availability: cleaned }
    const updatedParticipants = eventData.participants.filter((p) => p.id !== currentParticipant.id).concat(updatedParticipant)

    const payload: Partial<EventData> & { participants: Participant[] } = {
      ...eventData,
      participants: updatedParticipants,
    }
    if (!isCreator) {
      delete (payload as any).disabledSlots
    }

    try {
      const res = await fetchWithAuth(`${API_BASE}/events/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        setDraftDirty(false)
        await fetchEventData()
        toast({ title: "Availability Saved", description: "Updated successfully." })
      } else {
        if (res.status === 401) {
          clearTokens()
          router.push("/login")
          return
        }
        toast({ title: "Error", description: d.error || "Could not save", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Unexpected error", variant: "destructive" })
    }
  }

  const handleCancelDraft = () => {
    setDraftDirty(false)
    fetchEventData()
  }

  const handleRename = async () => {
    if (!isCreator || !eventData) return
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === eventData.name) {
      setRenameOpen(false)
      setRenameValue(eventData.name)
      return
    }
    setRenameLoading(true)

    const payload: any = {
      id: eventData.id,
      name: trimmed,
      dateRange: eventData.dateRange,
      duration: eventData.duration,
      timezone: eventData.timezone,
      participants: eventData.participants,
      disabledSlots: eventData.disabledSlots || [],
    }

    try {
      const res = await fetchWithAuth(`${API_BASE}/events/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        setEventData({ ...eventData, name: trimmed })
        toast({ title: "Event renamed" })
        setRenameOpen(false)
      } else {
        if (res.status === 401) clearTokens()
        toast({ title: "Error", description: d.error || "Could not rename", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Could not rename", variant: "destructive" })
    } finally {
      setRenameLoading(false)
    }
  }

  const handleToggleDisabled = async (slotKey: string) => {
    if (!eventData || !isCreator) return
    const current = new Set(eventData.disabledSlots || [])
    if (current.has(slotKey)) current.delete(slotKey)
    else current.add(slotKey)
    const disabledSlots = Array.from(current)
    const updatedEvent: EventData = { ...eventData, disabledSlots }

    try {
      const res = await fetchWithAuth(`${API_BASE}/events/${id}`, {
        method: "PUT",
        body: JSON.stringify(updatedEvent),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        setEventData(updatedEvent)
        toast({ title: current.has(slotKey) ? "Slot disabled" : "Slot enabled" })
      } else {
        if (res.status === 401) clearTokens()
        toast({ title: "Error", description: d.error || "Error updating", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Unexpected error", variant: "destructive" })
    }
  }

  const handleResetDisabled = async () => {
    if (!eventData || !isCreator) return
    setResetDisabledLoading(true)
    const updatedEvent: EventData = { ...eventData, disabledSlots: [] }

    try {
      const res = await fetchWithAuth(`${API_BASE}/events/${id}`, {
        method: "PUT",
        body: JSON.stringify(updatedEvent),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        setEventData(updatedEvent)
        toast({ title: "Disabled times reset" })
      } else {
        if (res.status === 401) clearTokens()
        toast({ title: "Error", description: d.error || "Error updating", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Unexpected error", variant: "destructive" })
    } finally {
      setResetDisabledLoading(false)
    }
  }

  const handleJoin = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/events/${id}/join`, { method: "POST" })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        toast({ title: "Joined!", description: "You can now mark your availability." })
        await fetchEventData()
      } else {
        if (res.status === 401) clearTokens()
        toast({ title: "Error", description: d.error || "Join failed", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Unexpected error", variant: "destructive" })
    }
  }

  const handleLeave = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/events/${id}/leave`, { method: "POST" })
      if (res.ok) {
        router.push("/dashboard")
        toast({ title: "Left Event" })
      } else if (res.status === 401) {
        clearTokens()
        router.push("/login")
      }
    } catch {
      toast({ title: "Error", description: "Unexpected error", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/events/${id}`, { method: "DELETE" })
      if (res.ok) {
        router.push("/dashboard")
        toast({ title: "Event Deleted" })
      } else if (res.status === 401) {
        clearTokens()
        router.push("/login")
      }
    } catch {
      toast({ title: "Error", description: "Unexpected error", variant: "destructive" })
    }
  }

  const handleInvite = async () => {
    if (!inviteUsername) return
    try {
      const res = await fetchWithAuth(`${API_BASE}/events/${id}/invite`, {
        method: "POST",
        body: JSON.stringify({ username: inviteUsername }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        toast({ title: "Invited!" })
        setInviteUsername("")
        fetchEventData()
      } else {
        if (res.status === 401) clearTokens()
        toast({ title: "Error", description: d.error || "Invite failed", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Unexpected error", variant: "destructive" })
    }
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    toast({ title: "Link Copied!" })
  }

  const handleRemoveParticipant = async (participantId: string) => {
    if (!eventData || !isCreator) return
    if (participantId === eventData.creatorId) return
    const updatedParticipants = eventData.participants.filter((p) => p.id !== participantId)
    const updatedEvent: EventData = {
      ...eventData,
      participants: updatedParticipants,
      disabledSlots: eventData.disabledSlots || [],
    }

    try {
      const res = await fetchWithAuth(`${API_BASE}/events/${id}`, {
        method: "PUT",
        body: JSON.stringify(updatedEvent),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        setEventData(updatedEvent)
        if (currentParticipant && currentParticipant.id === participantId) {
          setCurrentParticipant(null)
          setIsParticipant(false)
        }
        toast({ title: "Removed participant" })
      } else {
        if (res.status === 401) clearTokens()
        toast({ title: "Error", description: d.error || "Could not remove participant", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Unexpected error", variant: "destructive" })
    }
  }

  const getBestTimes = (limit?: number) => {
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
    const sorted = Object.entries(allSlots)
        .map(([slot, names]) => ({ slot, count: names.length, names }))
        .sort((a, b) => b.count - a.count)
    return typeof limit === "number" ? sorted.slice(0, limit) : sorted
  }

  const formatTimeInTz = (slotKey: string) => {
    try {
      const date = new Date(slotKey)
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString([], {
          timeZone: userTimezone,
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
          month: "short",
          day: "numeric",
        })
      }
      const [y, m, d, h, min] = slotKey.split(/[-:]/).map(Number)
      const fallbackDate = new Date(y, m - 1, d, h, min)
      return fallbackDate.toLocaleTimeString([], {
        timeZone: userTimezone,
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        month: "short",
        day: "numeric",
      })
    } catch (e) {
      return slotKey
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  if (!eventData) return <div className="flex items-center justify-center min-h-screen">Event not found</div>

  const disabledSlotsForGrid = eventData.disabledSlots || []
  const bestTimes = getBestTimes(3)
  const allBestTimes = getBestTimes()

  return (
      <div className="min-h-screen bg-background flex flex-col lg:h-screen lg:overflow-hidden">
        <div className="mx-auto w-full max-w-7xl flex flex-col flex-1 lg:h-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b bg-card/50 backdrop-blur-sm shrink-0 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 group">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{eventData.name}</h1>
                  {draftDirty && (
                      <Badge variant="secondary" className="flex items-center gap-1 text-[11px]">
                        <AlertTriangle className="h-3 w-3" />
                        Unsaved changes
                      </Badge>
                  )}
                  {isCreator && (
                      <AlertDialog open={renameOpen} onOpenChange={setRenameOpen}>
                        <AlertDialogTrigger asChild>
                          <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Rename event"
                              onClick={() => setRenameValue(eventData.name)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="sm:max-w-md">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Rename event</AlertDialogTitle>
                            <AlertDialogDescription>Update the event title for everyone. This change is instant.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="space-y-3 pt-2">
                            <Input
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                                placeholder="Event name"
                            />
                          </div>
                          <AlertDialogFooter className="mt-4">
                            <AlertDialogCancel disabled={renameLoading}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleRename} disabled={renameLoading}>
                              {renameLoading ? "Saving..." : "Save"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1.5">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-medium">
                    {format(new Date(eventData.dateRange.from), "MMM d")} - {format(new Date(eventData.dateRange.to), "MMM d")}
                  </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    <span className="capitalize truncate max-w-[140px] font-medium">{userTimezone.replace(/_/g, " ")}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <ThemeToggle />
              {draftDirty && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-9 text-xs" onClick={handleCancelDraft}>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Revert unsaved
                    </Button>
                  </div>
              )}
              <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push("/dashboard")}
                  className="text-xs px-3 h-9 font-medium"
              >
                <span className="hidden sm:inline">Dashboard</span>
                <span className="sm:hidden">Home</span>
              </Button>
              {isParticipant && !isCreator && (
                  <Button size="sm" variant="destructive" onClick={handleLeave} className="text-xs px-3 h-9 font-medium">
                    Leave
                  </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleShare} className="px-3 h-9 bg-transparent">
                <Share2 className="h-4 w-4" />
              </Button>
              {isCreator && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive" className="px-3 h-9">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="mx-4 max-w-sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Event?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
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

          <div className="flex-1 overflow-auto lg:overflow-hidden p-4 bg-background">
            <div className="flex flex-col lg:grid lg:grid-cols-[280px_1fr] gap-4 h-full">
              <div className="lg:overflow-y-auto lg:h-full">
                <Collapsible open={sidebarOpen} onOpenChange={setSidebarOpen} className="lg:hidden">
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between mb-3 h-10 font-medium bg-transparent">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{eventData.participants.length} Participants</span>
                        {bestTimes.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] font-semibold">
                              Best: {bestTimes[0].count}/{eventData.participants.length}
                            </Badge>
                        )}
                      </div>
                      {sidebarOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 mb-3">
                    <SidebarContent
                        eventData={eventData}
                        currentParticipant={currentParticipant}
                        isLoggedIn={isLoggedIn}
                        isParticipant={isParticipant}
                        isCreator={isCreator}
                        bestTimes={bestTimes}
                        allBestTimes={allBestTimes}
                        formatTimeInTz={formatTimeInTz}
                        inviteUsername={inviteUsername}
                        setInviteUsername={setInviteUsername}
                        handleInvite={handleInvite}
                        handleJoin={handleJoin}
                        handleRemoveParticipant={handleRemoveParticipant}
                        router={router}
                    />
                  </CollapsibleContent>
                </Collapsible>

                <div className="hidden lg:block space-y-3">
                  <SidebarContent
                      eventData={eventData}
                      currentParticipant={currentParticipant}
                      isLoggedIn={isLoggedIn}
                      isParticipant={isParticipant}
                      isCreator={isCreator}
                      bestTimes={bestTimes}
                      allBestTimes={allBestTimes}
                      formatTimeInTz={formatTimeInTz}
                      inviteUsername={inviteUsername}
                      setInviteUsername={setInviteUsername}
                      handleInvite={handleInvite}
                      handleJoin={handleJoin}
                      handleRemoveParticipant={handleRemoveParticipant}
                      router={router}
                  />
                </div>
              </div>

              <Card className="overflow-hidden flex flex-col shadow-sm min-h-[400px] lg:min-h-0 border-border/50">
                <CardContent
                    className="p-4 flex-1 overflow-auto min-h-0"
                    onPointerDown={() => {
                      if (isLoggedIn) setDraftDirty(true)
                    }}
                >
                  {isLoggedIn && currentParticipant ? (
                      <AvailabilityGrid
                          dateRange={{
                            from: new Date(eventData.dateRange.from),
                            to: new Date(eventData.dateRange.to),
                          }}
                          duration={30}
                          currentParticipant={currentParticipant}
                          allParticipants={eventData.participants}
                          onSave={handleSaveAvailability}
                          timezone={userTimezone}
                          disabledSlots={disabledSlotsForGrid}
                          isCreator={isCreator}
                          disableMode={disableMode}
                          onToggleDisabled={handleToggleDisabled}
                          onToggleDisableMode={() => setDisableMode((v) => !v)}
                          onResetDisabled={handleResetDisabled}
                          resetDisabledLoading={resetDisabledLoading}
                          hideDisabledSlots={!isCreator}
                      />
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full textcenter p-6">
                        <LogIn className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold">Please Sign In</h3>
                        <p className="text-sm text-muted-foreground mt-2 mb-4">You must be logged in to participate.</p>
                        <Button size="sm" onClick={() => router.push("/login")}>
                          Sign In Now
                        </Button>
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

function SidebarContent({
                          eventData,
                          currentParticipant,
                          isLoggedIn,
                          isParticipant,
                          isCreator,
                          bestTimes,
                          allBestTimes,
                          formatTimeInTz,
                          inviteUsername,
                          setInviteUsername,
                          handleInvite,
                          handleJoin,
                          handleRemoveParticipant,
                          router,
                        }: {
  eventData: EventData
  currentParticipant: Participant | null
  isLoggedIn: boolean
  isParticipant: boolean
  isCreator: boolean
  bestTimes: { slot: string; count: number; names: string[] }[]
  allBestTimes: { slot: string; count: number; names: string[] }[]
  formatTimeInTz: (slot: string) => string
  inviteUsername: string
  setInviteUsername: (v: string) => void
  handleInvite: () => void
  handleJoin: () => void
  handleRemoveParticipant: (id: string) => void
  router: ReturnType<typeof useRouter>
}) {
  const [showBestTimesDetails, setShowBestTimesDetails] = useState(false)

  return (
      <>
        {isLoggedIn && currentParticipant && (
            <Card className="shadow-sm border-border/50">
              <CardContent className="p-3.5">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0 border-2 border-primary/20">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                      {currentParticipant.name[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">You</div>
                    <div className="text-sm font-semibold truncate">{currentParticipant.name}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
        )}

        <Card className="shadow-sm border-border/50">
          <CardHeader className="p-3.5 pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Trophy className="h-4 w-4 text-yellow-500 shrink-0" /> Best Times
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 pt-0 space-y-2.5">
            {bestTimes.length > 0 ? (
                bestTimes.map((time, i) => (
                    <div
                        key={i}
                        className="rounded-lg border bg-card p-2.5 space-y-1.5 shadow-sm hover:shadow transition-shadow"
                    >
                      <div className="flex items-center justify_between gap-2">
                        <div className="text-xs font-semibold text-success truncate">{formatTimeInTz(time.slot)}</div>
                        <Badge variant="secondary" className="shrink-0 text-[10px] h-5 px-2 font-semibold">
                          {time.count}/{eventData.participants.length}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground line-clamp-1">{time.names.join(", ")}</div>
                    </div>
                ))
            ) : (
                <div className="text-xs text-muted-foreground text-center py-4">No overlaps yet</div>
            )}

            {allBestTimes.length > 0 && (
                <div className="space-y-2">
                  <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-between text-xs bg-transparent"
                      onClick={() => setShowBestTimesDetails((v) => !v)}
                  >
                    {showBestTimesDetails ? "Hide all best times" : "View all best times"}
                    {showBestTimesDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>

                  {showBestTimesDetails && (
                      <div className="max-h-48 overflow-y-auto space-y-1.5 border rounded-md p-2 bg-card/40">
                        {allBestTimes.map((time, i) => (
                            <div key={i} className="rounded-sm p-2 bg-muted/40 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-[11px] font-semibold truncate">{formatTimeInTz(time.slot)}</div>
                                <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                  {time.count}/{eventData.participants.length}
                                </Badge>
                              </div>
                              <div className="text-[10px] text-muted-foreground">{time.names.join(", ")}</div>
                            </div>
                        ))}
                      </div>
                  )}
                </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50">
          <CardHeader className="p-3.5 pb-2">
            <CardTitle className="flex items-center justify-between text-base font-semibold">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0" /> Participants
              </div>
              <Badge variant="outline" className="text-[10px] h-5 px-2 font-semibold">
                {eventData.participants.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 pt-0 space-y-1.5">
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {eventData.participants.map((p) => {
                const canRemove = isCreator && p.id !== eventData.creatorId
                return (
                    <div
                        key={p.id}
                        className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors group"
                    >
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarFallback className="text-[10px] font-semibold">{p.name[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium truncate flex-1">{p.name}</span>
                      {p.id === eventData.creatorId && (
                          <Badge variant="secondary" className="text-[10px] h-5 px-2">
                            Host
                          </Badge>
                      )}
                      {canRemove && (
                          <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleRemoveParticipant(p.id)}
                              title="Remove participant"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                      )}
                    </div>
                )
              })}
            </div>
            {!isLoggedIn && (
                <Button className="w_full mt-1.5 bg-transparent" size="sm" variant="outline" onClick={() => router.push("/login")}>
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

        {isCreator && (
            <Card className="shadow-sm border-border/50">
              <CardHeader className="p-3.5 pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <UserPlus className="h-4 w-4 shrink-0" /> Invite
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0">
                <div className="flex gap-1.5">
                  <Input
                      className="text-xs h-8"
                      placeholder="Username"
                      value={inviteUsername}
                      onChange={(e) => setInviteUsername(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  />
                  <Button size="sm" onClick={handleInvite} className="shrink-0 h-8 px-3 text-xs">
                    Invite
                  </Button>
                </div>
              </CardContent>
            </Card>
        )}
      </>
  )
}
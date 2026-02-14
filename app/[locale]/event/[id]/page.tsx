"use client"

import { use, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { AvailabilityGrid } from "@/components/availability-grid"
import {
  ShareNetwork,
  Users,
  Calendar,
  Trophy,
  SignIn,
  Trash,
  UserPlus,
  Globe,
  CaretDown,
  Pencil,
  ArrowClockwise,
  Warning,
  X,
  Clock,
  ChartBar,
  Envelope,
} from "phosphor-react"
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { fetchWithAuth, clearTokens, getAccessToken, getStoredUsername, ensureAuth } from "@/lib/api"
import { useTranslations } from "next-intl"

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
  draft?: {
    availability: Record<string, boolean>
    disabledSlots: string[]
    updatedAt?: string | null
  }
}

type TokenClaims = { uid?: string; sub?: string; uname?: string; username?: string; userId?: string; id?: string; name?: string }

function decodeToken(token: string | null | undefined): TokenClaims {
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
  const tCommon = useTranslations("common")
  const tEventPage = useTranslations("eventPage")

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
  const [friends, setFriends] = useState<{ id: string; username: string }[]>([])
  const [sseConnected, setSseConnected] = useState(false)
  const [draftDirty, setDraftDirty] = useState(false)
  const [pendingDisabledSlots, setPendingDisabledSlots] = useState<string[]>([])
  const [draftAvailability, setDraftAvailability] = useState<Record<string, boolean>>({})
  const [pendingDraft, setPendingDraft] = useState<{
    availability: Record<string, boolean>
    disabledSlots: string[]
    updatedAt?: string | null
  } | null>(null)
  const [gridKey, setGridKey] = useState(0)

  const [emailVerified, setEmailVerified] = useState(true)
  const [verificationExpiry, setVerificationExpiry] = useState<string | null>(null)
  const [hideVerificationBanner, setHideVerificationBanner] = useState(false)
  const [bestTimesOpen, setBestTimesOpen] = useState(false)

  const lastSavedEventRef = useRef<EventData | null>(null)
  const lastSavedParticipantRef = useRef<Participant | null>(null)

  const sseRetryDelayRef = useRef(5000)
  const sseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      await ensureAuth()
      setToken(getAccessToken() ?? null)
    }
    init()
  }, [])

  const tokenClaims = useMemo(() => decodeToken(token), [token])
  const userId = tokenClaims.uid || tokenClaims.sub || tokenClaims.userId || tokenClaims.id || null
  const usernameClaim = tokenClaims.uname || tokenClaims.username || tokenClaims.name || null

  const syncUserState = (data: EventData) => {
    const loggedIn = !!getAccessToken()
    setIsLoggedIn(loggedIn)
    setIsCreator(loggedIn && userId !== null && data.creatorId === userId)

    const existing = data.participants.find((p) => p.id === userId)
    if (existing) {
      setIsParticipant(true)
      if (!draftDirty) {
        setCurrentParticipant(existing)
        lastSavedParticipantRef.current = existing
        setDraftAvailability(existing.availability || {})
      }
    } else {
      setIsParticipant(false)
      if (loggedIn && userId && !draftDirty) {
        const name = getStoredUsername() || usernameClaim || "You"
        const fallback = { id: userId, name, availability: {} }
        setCurrentParticipant(fallback)
        setDraftAvailability({})
      } else if (!loggedIn) {
        setCurrentParticipant(null)
        setDraftAvailability({})
      }
    }
  }

  const applyServerDraft = (draft: EventData["draft"]) => {
    if (!draft) return
    const hasAvail = Object.keys(draft.availability || {}).length > 0
    const hasDisabled = (draft.disabledSlots || []).length > 0
    if (!hasAvail && !hasDisabled) return
    setPendingDraft({
      availability: draft.availability || {},
      disabledSlots: draft.disabledSlots || [],
      updatedAt: draft.updatedAt,
    })
  }

  const fetchEventData = async (force = false) => {
    if (draftDirty && !force) return
    const savedTz = localStorage.getItem("preferredTimezone")
    setUserTimezone(savedTz || Intl.DateTimeFormat().resolvedOptions().timeZone)

    try {
      const res = await fetch(`${API_BASE}/events/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (res.status === 429) {
        if (lastSavedEventRef.current) {
          setEventData(lastSavedEventRef.current)
          setCurrentParticipant(lastSavedParticipantRef.current)
        }
        return
      }
      if (res.ok) {
        const data: EventData = await res.json()
        data.disabledSlots = data.disabledSlots || []
        setEventData(data)
        syncUserState(data)
        setRenameValue(data.name)
        lastSavedEventRef.current = data
        applyServerDraft(data.draft)
      } else {
        if (res.status === 404) setEventData(null)
      }
    } catch (error) {
      console.error("Failed to fetch event", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEventData()
    if (sseConnected) return
    const timer = setInterval(() => fetchEventData(), 120000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sseConnected, draftDirty, token])

  useEffect(() => {
    if (!token) {
      setIsLoggedIn(false)
      return
    }
    const loadProfile = async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE}/users/me`, { method: "GET" })
        if (res.status === 401) {
          clearTokens()
          router.push("/login")
          return
        }
        if (res.ok) {
          const data = await res.json()
          setEmailVerified(!!data.emailVerified)
          setVerificationExpiry(data.verificationExpiry || null)
        }
      } catch (e) {
        console.error("Failed to load profile", e)
      }
    }
    loadProfile()

    const fetchFriends = async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE}/friends`, { method: "GET" })
        if (res.ok) {
          const data = await res.json()
          setFriends(Array.isArray(data) ? data : [])
        }
      } catch (e) {
        console.error("Failed to load friends", e)
      }
    }
    fetchFriends()
  }, [router])

  useEffect(() => {
    const accessToken = getAccessToken()
    if (!accessToken) return

    const connect = () => {
      const url = `${API_BASE}/events/${id}/stream?token=${encodeURIComponent(accessToken)}`
      const src = new EventSource(url)
      src.onopen = () => {
        setSseConnected(true)
        sseRetryDelayRef.current = 5000
      }
      src.onerror = () => {
        setSseConnected(false)
        src.close()
        const delay = Math.min(sseRetryDelayRef.current, 60000)
        if (sseTimerRef.current) clearTimeout(sseTimerRef.current)
        sseTimerRef.current = setTimeout(() => {
          sseTimerRef.current = null
          sseRetryDelayRef.current = Math.min(sseRetryDelayRef.current * 2, 60000)
          connect()
        }, delay)
      }
      src.onmessage = () => {
        if (!draftDirty) fetchEventData()
      }
    }

    connect()
    return () => {
      setSseConnected(false)
      if (sseTimerRef.current) {
        clearTimeout(sseTimerRef.current)
        sseTimerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, draftDirty])

  const clearDraftOnServer = async () => {
    try {
      await fetchWithAuth(`${API_BASE}/events/${id}/draft`, { method: "DELETE" })
    } catch {
      /* no-op */
    }
  }

  const handleSaveAvailability = async (availability: Record<string, boolean>) => {
    if (!eventData || !currentParticipant) return

    const disabled = pendingDisabledSlots.length > 0 ? pendingDisabledSlots : eventData.disabledSlots || []
    const cleaned: Record<string, boolean> = {}
    Object.entries(availability).forEach(([k, v]) => {
      if (!disabled.includes(k) && v) cleaned[k] = v
    })

    const updatedParticipant = { ...currentParticipant, availability: cleaned }

    const updatedParticipants = eventData.participants.map((p) =>
      p.id === currentParticipant.id ? updatedParticipant : p
    )

    const previousEventData = eventData
    const previousParticipant = currentParticipant

    setEventData({ ...eventData, participants: updatedParticipants, disabledSlots: disabled })
    setCurrentParticipant(updatedParticipant)
    setDraftDirty(false)

    const payload: Partial<EventData> & { participants: Participant[] } = {
      ...eventData,
      participants: updatedParticipants,
      disabledSlots: disabled,
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
        toast({ title: tEventPage("availabilitySaved"), description: tEventPage("updatedSuccessfully") })
        setPendingDisabledSlots([])
        lastSavedEventRef.current = { ...eventData, participants: updatedParticipants, disabledSlots: disabled }
        lastSavedParticipantRef.current = updatedParticipant
        await clearDraftOnServer()
      } else {
        setEventData(previousEventData)
        setCurrentParticipant(previousParticipant)
        setDraftDirty(true)

        if (res.status === 401) {
          clearTokens()
          router.push("/login")
          return
        }
        toast({ title: tEventPage("error"), description: d.error || tEventPage("saveFailed"), variant: "destructive" })
      }
    } catch (error) {
      setEventData(previousEventData)
      setCurrentParticipant(previousParticipant)
      setDraftDirty(true)
      toast({ title: tEventPage("error"), description: tEventPage("unexpectedError"), variant: "destructive" })
    }
  }

  const handleCancelDraft = async () => {
    setDraftDirty(false)
    setPendingDisabledSlots([])
    await clearDraftOnServer().catch(() => { })
    if (lastSavedEventRef.current) {
      setEventData(lastSavedEventRef.current)
      setCurrentParticipant(lastSavedParticipantRef.current)
      setGridKey((k) => k + 1)
    }
    fetchEventData(true)
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
        const next = { ...eventData, name: trimmed }
        setEventData(next)
        lastSavedEventRef.current = next
        toast({ title: tEventPage("eventRenamed") })
        setRenameOpen(false)
      } else {
        if (res.status === 401) clearTokens()
        toast({ title: tEventPage("error"), description: d.error || tEventPage("renameFailed"), variant: "destructive" })
      }
    } catch {
      toast({ title: tEventPage("error"), description: tEventPage("renameFailed"), variant: "destructive" })
    } finally {
      setRenameLoading(false)
    }
  }

  const handleToggleDisabled = (slotKey: string) => {
    if (!eventData || !isCreator) return
    const current = new Set(pendingDisabledSlots.length > 0 ? pendingDisabledSlots : eventData.disabledSlots || [])
    if (current.has(slotKey)) current.delete(slotKey)
    else current.add(slotKey)
    setPendingDisabledSlots(Array.from(current))
    setDraftDirty(true)
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
        setPendingDisabledSlots([])
        lastSavedEventRef.current = updatedEvent
        toast({ title: tEventPage("disabledTimesReset") })
        await clearDraftOnServer()
      } else {
        if (res.status === 401) clearTokens()
        toast({ title: tEventPage("error"), description: d.error || tEventPage("errorUpdating"), variant: "destructive" })
      }
    } catch {
      toast({ title: tEventPage("error"), description: tEventPage("unexpectedError"), variant: "destructive" })
    } finally {
      setResetDisabledLoading(false)
    }
  }

  const handleJoin = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/events/${id}/join`, { method: "POST" })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        toast({ title: tEventPage("joined"), description: tEventPage("youCanMark") })
        await fetchEventData(true)
      } else {
        if (res.status === 401) clearTokens()
        toast({ title: tEventPage("error"), description: d.error || tEventPage("joinFailed"), variant: "destructive" })
      }
    } catch {
      toast({ title: tEventPage("error"), description: tEventPage("unexpectedError"), variant: "destructive" })
    }
  }

  const handleLeave = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/events/${id}/leave`, { method: "POST" })
      if (res.ok) {
        router.push("/dashboard")
        toast({ title: tEventPage("leftEvent") })
      } else if (res.status === 401) {
        clearTokens()
        router.push("/login")
      }
    } catch {
      toast({ title: tEventPage("error"), description: tEventPage("unexpectedError"), variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/events/${id}`, { method: "DELETE" })
      if (res.ok) {
        router.push("/dashboard")
        toast({ title: tEventPage("eventDeleted") })
      } else if (res.status === 401) {
        clearTokens()
        router.push("/login")
      }
    } catch {
      toast({ title: tEventPage("error"), description: tEventPage("unexpectedError"), variant: "destructive" })
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
        toast({ title: tEventPage("invited") })
        setInviteUsername("")
        fetchEventData()
      } else {
        if (res.status === 401) clearTokens()
        toast({ title: tEventPage("error"), description: d.error || tEventPage("inviteFailed"), variant: "destructive" })
      }
    } catch {
      toast({ title: tEventPage("error"), description: tEventPage("unexpectedError"), variant: "destructive" })
    }
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    toast({ title: tEventPage("linkCopied") })
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
        lastSavedEventRef.current = updatedEvent
        toast({ title: tEventPage("removedParticipant") })
      } else {
        if (res.status === 401) clearTokens()
        toast({ title: tEventPage("error"), description: d.error || tEventPage("removeFailed"), variant: "destructive" })
      }
    } catch {
      toast({ title: tEventPage("error"), description: tEventPage("unexpectedError"), variant: "destructive" })
    }
  }

  const handleResendVerification = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/verify-email/resend`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        clearTokens()
        router.push("/login")
        return
      }
      if (res.ok) {
        toast({ title: tEventPage("verificationSent"), description: tEventPage("checkInbox") })
      } else {
        toast({ title: tEventPage("error"), description: data.error || tEventPage("resendFailed"), variant: "destructive" })
      }
    } catch {
      toast({ title: tEventPage("error"), description: tEventPage("failedConnect"), variant: "destructive" })
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

  const formatDurationText = (mins: number | undefined | null) => {
    if (!mins || Number.isNaN(mins) || mins <= 0) return ""
    const h = Math.floor(mins / 60)
    const m = mins % 60
    const parts: string[] = []
    if (h > 0) parts.push(`${h} ${h === 1 ? tEventPage("hour") : tEventPage("hours")}`)
    if (m > 0) parts.push(`${m} ${m === 1 ? tEventPage("minute") : tEventPage("minutes")}`)
    return parts.join(" ")
  }

  useEffect(() => {
    if (!draftDirty || !isLoggedIn || !currentParticipant) return
    const timer = setTimeout(async () => {
      try {
        const payload: any = { availability: draftAvailability }
        if (isCreator) {
          payload.disabledSlots =
            pendingDisabledSlots.length > 0 ? pendingDisabledSlots : eventData?.disabledSlots || []
        }
        await fetchWithAuth(`${API_BASE}/events/${id}/draft`, {
          method: "PUT",
          body: JSON.stringify(payload),
        })
      } catch {
        // silent
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [draftDirty, draftAvailability, pendingDisabledSlots, isCreator, isLoggedIn, currentParticipant, eventData, id])

  const resumeDraft = () => {
    if (!pendingDraft || !currentParticipant) return
    setDraftAvailability(pendingDraft.availability || {})
    setCurrentParticipant({ ...currentParticipant, availability: pendingDraft.availability || {} })
    if (isCreator) {
      setPendingDisabledSlots(pendingDraft.disabledSlots || [])
    }
    setDraftDirty(true)
    setPendingDraft(null)
    setGridKey((k) => k + 1)
  }

  const discardDraft = async () => {
    await clearDraftOnServer().catch(() => { })
    setPendingDraft(null)
    setDraftDirty(false)
    setPendingDisabledSlots([])
    if (lastSavedEventRef.current) {
      setEventData(lastSavedEventRef.current)
      setCurrentParticipant(lastSavedParticipantRef.current)
      setGridKey((k) => k + 1)
    }
    fetchEventData(true)
  }

  const renderVerificationBanner = () => {
    if (emailVerified || hideVerificationBanner) return null
    return (
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 text-amber-900 dark:text-amber-100 p-4 shadow-sm">
          <div className="flex items-start gap-3 flex-1">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
              <Warning className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-1.5 flex-1">
              <p className="font-bold text-sm">{tEventPage("emailNotVerifiedTitle")}</p>
              <p className="text-sm text-amber-800 dark:text-amber-200/80">
                {tEventPage("emailNotVerifiedBody")}
                {verificationExpiry && (
                  <span className="block text-xs text-amber-700 dark:text-amber-300/70 mt-1">
                    {tEventPage("expiresPrefix")} {new Date(verificationExpiry).toLocaleString()}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="outline" className="border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/50 gap-1.5" onClick={handleResendVerification}>
                  <Envelope className="h-3.5 w-3.5" />
                  {tEventPage("sendVerificationAgain")}
                </Button>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 shrink-0" onClick={() => setHideVerificationBanner(true)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center animate-pulse shadow-lg shadow-primary/20">
        <Calendar className="h-6 w-6 text-primary-foreground" />
      </div>
      <p className="text-muted-foreground font-medium">{tEventPage("loading")}</p>
    </div>
  )
  if (!eventData) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center shadow-inner">
        <Calendar className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold">{tEventPage("notFound")}</p>
        <p className="text-sm text-muted-foreground mt-1">This event may have been deleted or moved.</p>
      </div>
      <Button variant="outline" onClick={() => router.push("/dashboard")} className="mt-2">
        {tEventPage("dashboard")}
      </Button>
    </div>
  )

  const disabledSlotsForGrid = pendingDisabledSlots.length > 0 ? pendingDisabledSlots : eventData.disabledSlots || []
  const bestTimes = getBestTimes(3)
  const allBestTimes = getBestTimes()
  const totalParticipants = eventData.participants.length || 1
  const bestChartData = (allBestTimes.length ? allBestTimes : bestTimes).slice(0, 10)

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col lg:h-screen lg:overflow-hidden">
      <div className="mx-auto w-full max-w-7xl flex flex-col flex-1 lg:h-full">
        {/* Modern Header with Gradient Accent */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 border-b border-border/40 backdrop-blur-sm shrink-0 gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {/* Event Icon */}
              <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 shrink-0">
                <Calendar className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 group">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                    {eventData.name}
                  </h1>
                  {draftDirty && (
                    <Badge variant="secondary" className="flex items-center gap-1 text-[11px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                      <Warning className="h-3 w-3" />
                      {tEventPage("unsavedChanges")}
                    </Badge>
                  )}
                  {isCreator && (
                    <AlertDialog open={renameOpen} onOpenChange={setRenameOpen}>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-primary/10"
                          title={tEventPage("renameEvent")}
                          onClick={() => setRenameValue(eventData.name)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="sm:max-w-md">
                        <AlertDialogHeader>
                          <AlertDialogTitle>{tEventPage("renameEvent")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {tEventPage("renameDescription")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-3 pt-2">
                          <Input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleRename()}
                            placeholder={tEventPage("eventNamePlaceholder")}
                          />
                        </div>
                        <AlertDialogFooter className="mt-4">
                          <AlertDialogCancel disabled={renameLoading}>{tEventPage("cancel")}</AlertDialogCancel>
                          <AlertDialogAction onClick={handleRename} disabled={renameLoading}>
                            {renameLoading ? tEventPage("saving") : tEventPage("save")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                {/* Event Meta Info Pills */}
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span>
                      {format(new Date(eventData.dateRange.from), "MMM d")} – {format(new Date(eventData.dateRange.to), "MMM d")}
                    </span>
                  </div>

                  {eventData.duration > 0 && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      <span>{formatDurationText(eventData.duration)}</span>
                    </div>
                  )}

                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                    <Globe className="h-3.5 w-3.5 text-primary" />
                    <span className="capitalize truncate max-w-[140px]">
                      {userTimezone.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <ThemeToggle />
              {draftDirty && (
                <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20" onClick={handleCancelDraft}>
                  <ArrowClockwise className="h-4 w-4" />
                  <span className="hidden sm:inline">{tEventPage("revertUnsaved")}</span>
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push("/dashboard")}
                className="h-9 px-3 text-xs font-medium hover:bg-muted/80 transition-colors"
              >
                <span className="hidden sm:inline">{tEventPage("dashboard")}</span>
                <span className="sm:hidden">{tEventPage("home")}</span>
              </Button>
              {isParticipant && !isCreator && (
                <Button size="sm" variant="destructive" onClick={handleLeave} className="h-9 px-3 text-xs font-medium shadow-sm">
                  {tEventPage("leave")}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleShare} className="h-9 w-9 p-0 hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all">
                <ShareNetwork className="h-4 w-4" />
              </Button>
              {isCreator && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="h-9 w-9 p-0 shadow-sm">
                      <Trash className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="mx-4 max-w-sm">
                    <AlertDialogHeader>
                      <AlertDialogTitle>{tEventPage("deleteEventTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>{tEventPage("deleteEventDescription")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{tEventPage("cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>{tEventPage("delete")}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>

        <div className="py-3 px-4 sm:px-6">{renderVerificationBanner()}</div>

        <div className="flex-1 overflow-auto lg:overflow-hidden p-4 sm:px-6 bg-transparent">
          <div className="flex flex-col lg:grid lg:grid-cols-[300px_1fr] gap-5 h-full">
            {/* Sidebar */}
            <div className="lg:overflow-y-auto lg:h-full lg:pr-2 space-y-4">
              {/* Mobile Collapsible */}
              <Collapsible open={sidebarOpen} onOpenChange={setSidebarOpen} className="lg:hidden">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-12 font-medium bg-card hover:bg-muted/50 border-border/60 shadow-sm transition-all">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-semibold">{tEventPage("participantsCount", { count: eventData.participants.length })}</span>
                      {bestTimes.length > 0 && (
                        <Badge className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                          {tEventPage("best")} {bestTimes[0].count}/{eventData.participants.length}
                        </Badge>
                      )}
                    </div>
                    <div className={`transition-transform duration-200 ${sidebarOpen ? 'rotate-180' : ''}`}>
                      <CaretDown className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 mt-4 animate-in slide-in-from-top-2 duration-200">
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
                    onOpenBestTimes={() => setBestTimesOpen(true)}
                    friends={friends}
                  />
                </CollapsibleContent>
              </Collapsible>

              {/* Desktop Sidebar */}
              <div className="hidden lg:block space-y-4">
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
                  onOpenBestTimes={() => setBestTimesOpen(true)}
                  friends={friends}
                />
              </div>
            </div>

            {/* Main Grid Card */}
            <Card className="overflow-hidden flex flex-col shadow-lg min-h-[450px] lg:min-h-0 border-border/40 bg-card/95 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4 flex-1 overflow-hidden min-h-0 flex flex-col">
                {isLoggedIn && currentParticipant ? (
                  <AvailabilityGrid
                    key={gridKey}
                    dateRange={{
                      from: new Date(eventData.dateRange.from),
                      to: new Date(eventData.dateRange.to),
                    }}
                    duration={eventData.duration ?? 30}
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
                    onSlotInteraction={() => {
                      if (isLoggedIn) setDraftDirty(true)
                    }}
                    onAvailabilityChange={(avail) => {
                      setDraftAvailability(avail)
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-5 shadow-lg shadow-primary/10">
                      <SignIn className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold">{tEventPage("signInTitle")}</h3>
                    <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-xs">
                      {tEventPage("signInSubtitle")}
                    </p>
                    <Button onClick={() => router.push("/login")} className="gap-2 shadow-md shadow-primary/20 hover:shadow-lg transition-shadow">
                      <SignIn className="h-4 w-4" />
                      {tEventPage("signInNow")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={!!pendingDraft} onOpenChange={(open) => !open && setPendingDraft(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tEventPage("resumeDraftTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tEventPage("resumeDraftDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={discardDraft}>{tEventPage("discard")}</AlertDialogCancel>
            <AlertDialogAction onClick={resumeDraft}>{tEventPage("resume")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={bestTimesOpen} onOpenChange={setBestTimesOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-lg">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground shadow-md">
                <ChartBar className="h-5 w-5" />
              </div>
              {tEventPage("bestTimesChartTitle")}
            </DialogTitle>
            <DialogDescription className="pt-1">{tEventPage("bestTimesChartDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Top Times Highlights */}
            <div className="flex flex-wrap gap-2">
              {bestChartData.slice(0, 3).map((slot, i) => (
                <Badge
                  key={slot.slot}
                  className={`text-xs py-1.5 px-3 ${
                    i === 0 
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0 shadow-md' 
                      : i === 1 
                      ? 'bg-gradient-to-r from-slate-400 to-slate-300 text-slate-900 border-0 shadow-sm'
                      : 'bg-gradient-to-r from-amber-700 to-amber-600 text-white border-0 shadow-sm'
                  }`}
                >
                  <span className="mr-1">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                  {formatTimeInTz(slot.slot)} — {slot.count}/{totalParticipants}
                </Badge>
              ))}
            </div>

            {/* Chart Bars */}
            <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
              {bestChartData.map((slot, i) => {
                const pct = Math.max(6, (slot.count / totalParticipants) * 100)
                return (
                  <div key={slot.slot} className="flex items-center gap-3 group">
                    <div className="w-36 sm:w-44 text-sm font-medium truncate text-muted-foreground group-hover:text-foreground transition-colors">
                      {formatTimeInTz(slot.slot)}
                    </div>
                    <div className="flex-1 h-9 rounded-lg border border-border/40 bg-muted/40 overflow-hidden shadow-inner">
                      <div
                        className={`h-full flex items-center px-3 transition-all duration-300 ${
                          i === 0 
                            ? 'bg-gradient-to-r from-primary to-primary/80' 
                            : 'bg-gradient-to-r from-primary/70 to-primary/50'
                        } text-primary-foreground text-xs font-semibold shadow-sm`}
                        style={{ width: `${pct}%` }}
                      >
                        {slot.count}/{totalParticipants}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="text-xs text-muted-foreground flex items-center gap-4 pt-2 border-t border-border/40">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-gradient-to-r from-primary to-primary/80 shadow-sm" />
                {tEventPage("legendMost")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-muted border border-border/60" />
                {tEventPage("legendLeast")}
              </span>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setBestTimesOpen(false)} className="gap-2">
              {tEventPage("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  onOpenBestTimes,
  friends,
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
  onOpenBestTimes: () => void
  friends: { id: string; username: string }[]
}) {
  const tCommon = useTranslations("common")
  const tEventPage = useTranslations("eventPage")

  return (
    <>
      {/* Current User Card */}
      {isLoggedIn && currentParticipant && (
        <Card className="shadow-md border-border/40 bg-gradient-to-br from-card to-muted/20 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 shrink-0 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-base font-bold">
                  {currentParticipant.name[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wider text-primary font-bold">{tEventPage("you")}</div>
                <div className="text-base font-semibold truncate">{currentParticipant.name}</div>
              </div>
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Online" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Best Times Card */}
      <Card className="shadow-md border-border/40 overflow-hidden">
        <CardHeader className="p-4 pb-3 bg-gradient-to-r from-amber-50 to-yellow-50/50 dark:from-amber-950/20 dark:to-yellow-950/10 border-b border-amber-200/50 dark:border-amber-800/30">
          <CardTitle className="flex items-center gap-2.5 text-base font-bold">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-sm">
              <Trophy className="h-4 w-4 text-white" />
            </div>
            {tEventPage("bestTimes")}
          </CardTitle>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border-amber-200 dark:border-amber-800/50" onClick={onOpenBestTimes}>
              <ChartBar className="h-3.5 w-3.5" />
              {tEventPage("viewBestTimes")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-2.5">
          {bestTimes.length > 0 ? (
            bestTimes.map((time, i) => (
              <div
                key={i}
                className={`rounded-xl p-3 space-y-1.5 transition-all duration-200 hover:scale-[1.02] cursor-default ${
                  i === 0 
                    ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200/60 dark:border-emerald-800/40 shadow-sm' 
                    : 'bg-muted/40 border border-border/40 hover:bg-muted/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className={`text-xs font-semibold truncate ${i === 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>
                    {formatTimeInTz(time.slot)}
                  </div>
                  <Badge
                    className={`shrink-0 text-[10px] h-5 px-2 font-bold border-0 ${
                      i === 0 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-muted-foreground/20 text-muted-foreground'
                    }`}
                  >
                    {time.count}/{eventData.participants.length}
                  </Badge>
                </div>
                <div className="text-[10px] text-muted-foreground line-clamp-1">
                  {time.names.join(", ")}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground text-center py-6 px-4">
              <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-2">
                <Trophy className="h-5 w-5 text-muted-foreground/50" />
              </div>
              {tEventPage("noOverlaps")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Participants Card */}
      <Card className="shadow-md border-border/40 overflow-hidden">
        <CardHeader className="p-4 pb-3 border-b border-border/40">
          <CardTitle className="flex items-center justify-between text-base font-bold">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm">
                <Users className="h-4 w-4 text-primary-foreground" />
              </div>
              {tEventPage("participantsTitle")}
            </div>
            <Badge variant="outline" className="text-xs h-6 px-2.5 font-bold">
              {eventData.participants.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-2">
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {eventData.participants.map((p) => {
              const canRemove = isCreator && p.id !== eventData.creatorId
              const isHost = p.id === eventData.creatorId
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-2.5 p-2 rounded-lg transition-all duration-150 group ${
                    isHost 
                      ? 'bg-primary/5 border border-primary/20' 
                      : 'hover:bg-muted/60 border border-transparent'
                  }`}
                >
                  <Avatar className={`h-7 w-7 shrink-0 ${isHost ? 'ring-2 ring-primary/30' : ''}`}>
                    <AvatarFallback className={`text-[11px] font-semibold ${isHost ? 'bg-primary text-primary-foreground' : ''}`}>
                      {p.name[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium truncate flex-1">{p.name}</span>
                  {isHost && (
                    <Badge className="text-[9px] h-5 px-2 bg-primary/10 text-primary border-primary/20 font-bold">
                      {tEventPage("host")}
                    </Badge>
                  )}
                  {canRemove && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive/70 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                      onClick={() => handleRemoveParticipant(p.id)}
                      title={tEventPage("removeParticipant")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Action Buttons */}
          {!isLoggedIn && (
            <Button className="w-full mt-2 gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-md shadow-primary/20" onClick={() => router.push("/login")}>
              <SignIn className="h-4 w-4" />
              {tEventPage("signInRegister")}
            </Button>
          )}
          {isLoggedIn && !isParticipant && (
            <Button className="w-full mt-2 gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-md shadow-primary/20" onClick={handleJoin}>
              <UserPlus className="h-4 w-4" />
              {tEventPage("joinEvent")}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Invite Card (Creator Only) */}
      {isCreator && (
        <Card className="shadow-md border-border/40 overflow-hidden">
          <CardHeader className="p-4 pb-3 border-b border-border/40">
            <CardTitle className="flex items-center gap-2.5 text-base font-bold">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-sm">
                <UserPlus className="h-4 w-4 text-white" />
              </div>
              {tEventPage("invite")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-2">
              <Input
                className="text-sm h-9 bg-background/50 border-border/60 focus:border-primary/50 transition-colors"
                placeholder={tEventPage("usernamePlaceholder")}
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />
              <Button onClick={handleInvite} className="shrink-0 h-9 px-4 gap-1.5 shadow-sm">
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">{tEventPage("invite")}</span>
              </Button>
            </div>
            {friends.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold px-1">Quick invite from friends</p>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {friends
                    .filter((f) => !eventData.participants.some((p) => p.id === f.id))
                    .map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/60 border border-transparent hover:border-border/40 transition-all group cursor-pointer"
                        onClick={() => {
                          setInviteUsername(friend.username)
                          handleInvite()
                        }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <Avatar className="h-6 w-6 shrink-0">
                            <AvatarFallback className="text-[10px] font-semibold">{friend.username[0].toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium truncate">{friend.username}</span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-all text-primary hover:text-primary hover:bg-primary/10 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            setInviteUsername(friend.username)
                            handleInvite()
                          }}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}
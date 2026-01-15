"use client"

import { use, useEffect, useMemo, useRef, useState } from "react"
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
  Clock,
  BarChart3,
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"
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
import { fetchWithAuth, clearTokens, getAccessToken, getStoredUsername } from "@/lib/api"
import { useTranslations } from "@/components/language-provider"

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
  const { t } = useTranslations()

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

  const token = useMemo(() => getAccessToken() ?? null, [])
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
  }, [id, sseConnected, draftDirty])

  useEffect(() => {
    const accessToken = getAccessToken()
    if (!accessToken) {
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
        toast({ title: t("eventPage.availabilitySaved"), description: t("eventPage.updatedSuccessfully") })
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
        toast({ title: t("eventPage.error"), description: d.error || t("eventPage.saveFailed"), variant: "destructive" })
      }
    } catch (error) {
      setEventData(previousEventData)
      setCurrentParticipant(previousParticipant)
      setDraftDirty(true)
      toast({ title: t("eventPage.error"), description: t("eventPage.unexpectedError"), variant: "destructive" })
    }
  }

  const handleCancelDraft = async () => {
    setDraftDirty(false)
    setPendingDisabledSlots([])
    await clearDraftOnServer().catch(() => {})
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
        toast({ title: t("eventPage.eventRenamed") })
        setRenameOpen(false)
      } else {
        if (res.status === 401) clearTokens()
        toast({ title: t("eventPage.error"), description: d.error || t("eventPage.renameFailed"), variant: "destructive" })
      }
    } catch {
      toast({ title: t("eventPage.error"), description: t("eventPage.renameFailed"), variant: "destructive" })
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
        toast({ title: t("eventPage.disabledTimesReset") })
        await clearDraftOnServer()
      } else {
        if (res.status === 401) clearTokens()
        toast({ title: t("eventPage.error"), description: d.error || t("eventPage.errorUpdating"), variant: "destructive" })
      }
    } catch {
      toast({ title: t("eventPage.error"), description: t("eventPage.unexpectedError"), variant: "destructive" })
    } finally {
      setResetDisabledLoading(false)
    }
  }

  const handleJoin = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/events/${id}/join`, { method: "POST" })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        toast({ title: t("eventPage.joined"), description: t("eventPage.youCanMark") })
        await fetchEventData(true)
      } else {
        if (res.status === 401) clearTokens()
        toast({ title: t("eventPage.error"), description: d.error || t("eventPage.joinFailed"), variant: "destructive" })
      }
    } catch {
      toast({ title: t("eventPage.error"), description: t("eventPage.unexpectedError"), variant: "destructive" })
    }
  }

  const handleLeave = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/events/${id}/leave`, { method: "POST" })
      if (res.ok) {
        router.push("/dashboard")
        toast({ title: t("eventPage.leftEvent") })
      } else if (res.status === 401) {
        clearTokens()
        router.push("/login")
      }
    } catch {
      toast({ title: t("eventPage.error"), description: t("eventPage.unexpectedError"), variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/events/${id}`, { method: "DELETE" })
      if (res.ok) {
        router.push("/dashboard")
        toast({ title: t("eventPage.eventDeleted") })
      } else if (res.status === 401) {
        clearTokens()
        router.push("/login")
      }
    } catch {
      toast({ title: t("eventPage.error"), description: t("eventPage.unexpectedError"), variant: "destructive" })
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
        toast({ title: t("eventPage.invited") })
        setInviteUsername("")
        fetchEventData()
      } else {
        if (res.status === 401) clearTokens()
        toast({ title: t("eventPage.error"), description: d.error || t("eventPage.inviteFailed"), variant: "destructive" })
      }
    } catch {
      toast({ title: t("eventPage.error"), description: t("eventPage.unexpectedError"), variant: "destructive" })
    }
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    toast({ title: t("eventPage.linkCopied") })
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
        toast({ title: t("eventPage.removedParticipant") })
      } else {
        if (res.status === 401) clearTokens()
        toast({ title: t("eventPage.error"), description: d.error || t("eventPage.removeFailed"), variant: "destructive" })
      }
    } catch {
      toast({ title: t("eventPage.error"), description: t("eventPage.unexpectedError"), variant: "destructive" })
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
        toast({ title: t("eventPage.verificationSent"), description: t("eventPage.checkInbox") })
      } else {
        toast({ title: t("eventPage.error"), description: data.error || t("eventPage.resendFailed"), variant: "destructive" })
      }
    } catch {
      toast({ title: t("eventPage.error"), description: t("eventPage.failedConnect"), variant: "destructive" })
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
    if (h > 0) parts.push(`${h} ${h === 1 ? t("eventPage.hour") : t("eventPage.hours")}`)
    if (m > 0) parts.push(`${m} ${m === 1 ? t("eventPage.minute") : t("eventPage.minutes")}`)
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
    await clearDraftOnServer().catch(() => {})
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
        <div className="mx-auto w-full max-w-7xl px-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-4 shadow-sm">
            <div className="flex items-start gap-3 flex-1">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">{t("eventPage.emailNotVerifiedTitle")}</p>
                <p className="text-sm">
                  {t("eventPage.emailNotVerifiedBody")}
                  {verificationExpiry && (
                      <span className="block text-xs text-amber-800 mt-1">
                    {t("eventPage.expiresPrefix")} {new Date(verificationExpiry).toLocaleString()}
                  </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" className="border-amber-300 text-amber-900" onClick={handleResendVerification}>
                    {t("eventPage.sendVerificationAgain")}
                  </Button>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="text-amber-700" onClick={() => setHideVerificationBanner(true)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
    )
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen">{t("eventPage.loading")}</div>
  if (!eventData) return <div className="flex items-center justify-center min-h-screen">{t("eventPage.notFound")}</div>

  const disabledSlotsForGrid = pendingDisabledSlots.length > 0 ? pendingDisabledSlots : eventData.disabledSlots || []
  const bestTimes = getBestTimes(3)
  const allBestTimes = getBestTimes()
  const totalParticipants = eventData.participants.length || 1
  const bestChartData = (allBestTimes.length ? allBestTimes : bestTimes).slice(0, 10)

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
                        {t("eventPage.unsavedChanges")}
                      </Badge>
                  )}
                  {isCreator && (
                      <AlertDialog open={renameOpen} onOpenChange={setRenameOpen}>
                        <AlertDialogTrigger asChild>
                          <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              title={t("eventPage.renameEvent")}
                              onClick={() => setRenameValue(eventData.name)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="sm:max-w-md">
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("eventPage.renameEvent")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("eventPage.renameDescription")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="space-y-3 pt-2">
                            <Input
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                                placeholder={t("eventPage.eventNamePlaceholder")}
                            />
                          </div>
                          <AlertDialogFooter className="mt-4">
                            <AlertDialogCancel disabled={renameLoading}>{t("eventPage.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={handleRename} disabled={renameLoading}>
                              {renameLoading ? t("eventPage.saving") : t("eventPage.save")}
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
                    {format(new Date(eventData.dateRange.from), "MMM d")} -{" "}
                      {format(new Date(eventData.dateRange.to), "MMM d")}
                  </span>
                  </div>

                  {eventData.duration > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span className="font-medium">{formatDurationText(eventData.duration)}</span>
                      </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    <span className="capitalize truncate max-w-[140px] font-medium">
                    {userTimezone.replace(/_/g, " ")}
                  </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <LanguageToggle className="w-[150px]" />
              <ThemeToggle />
              {draftDirty && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-9 text-xs" onClick={handleCancelDraft}>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      {t("eventPage.revertUnsaved")}
                    </Button>
                  </div>
              )}
              <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push("/dashboard")}
                  className="text-xs px-3 h-9 font-medium"
              >
                <span className="hidden sm:inline">{t("eventPage.dashboard")}</span>
                <span className="sm:hidden">{t("eventPage.home")}</span>
              </Button>
              {isParticipant && !isCreator && (
                  <Button size="sm" variant="destructive" onClick={handleLeave} className="text-xs px-3 h-9 font-medium">
                    {t("eventPage.leave")}
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
                        <AlertDialogTitle>{t("eventPage.deleteEventTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>{t("eventPage.deleteEventDescription")}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("eventPage.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>{t("eventPage.delete")}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
              )}
            </div>
          </div>

          <div className="py-3 px-4">{renderVerificationBanner()}</div>

          <div className="flex-1 overflow-auto lg:overflow-hidden p-4 bg-background">
            <div className="flex flex-col lg:grid lg:grid-cols-[280px_1fr] gap-4 h-full">
              <div className="lg:overflow-y-auto lg:h-full">
                <Collapsible open={sidebarOpen} onOpenChange={setSidebarOpen} className="lg:hidden">
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between mb-3 h-10 font-medium bg-transparent">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{t("eventPage.participantsCount", { count: eventData.participants.length })}</span>
                        {bestTimes.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] font-semibold">
                              {t("eventPage.best")} {bestTimes[0].count}/{eventData.participants.length}
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
                        onOpenBestTimes={() => setBestTimesOpen(true)}
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
                      onOpenBestTimes={() => setBestTimesOpen(true)}
                  />
                </div>
              </div>

              <Card className="overflow-hidden flex flex-col shadow-sm min-h-[400px] lg:min-h-0 border-border/50">
                <CardContent className="p-4 flex-1 overflow-auto min-h-0">
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
                      <div className="flex flex-col items-center justify-center h-full text-center p-6">
                        <LogIn className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold">{t("eventPage.signInTitle")}</h3>
                        <p className="text-sm text-muted-foreground mt-2 mb-4">
                          {t("eventPage.signInSubtitle")}
                        </p>
                        <Button size="sm" onClick={() => router.push("/login")}>
                          {t("eventPage.signInNow")}
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
              <AlertDialogTitle>{t("eventPage.resumeDraftTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("eventPage.resumeDraftDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={discardDraft}>{t("eventPage.discard")}</AlertDialogCancel>
              <AlertDialogAction onClick={resumeDraft}>{t("eventPage.resume")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={bestTimesOpen} onOpenChange={setBestTimesOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {t("eventPage.bestTimesChartTitle")}
              </DialogTitle>
              <DialogDescription>{t("eventPage.bestTimesChartDescription")}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {bestChartData.slice(0, 3).map((slot) => (
                    <Badge key={slot.slot} variant="secondary" className="text-xs py-1 px-2">
                      {formatTimeInTz(slot.slot)} — {slot.count}/{totalParticipants}
                    </Badge>
                ))}
              </div>

              <div className="space-y-2">
                {bestChartData.map((slot) => {
                  const pct = Math.max(4, (slot.count / totalParticipants) * 100)
                  return (
                      <div key={slot.slot} className="flex items-center gap-3">
                        <div className="w-40 text-sm font-medium truncate">{formatTimeInTz(slot.slot)}</div>
                        <div className="flex-1 h-8 rounded-md border border-border/60 bg-muted/60 overflow-hidden">
                          <div
                              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-semibold flex items-center px-2"
                              style={{ width: `${pct}%` }}
                          >
                            {slot.count}/{totalParticipants}
                          </div>
                        </div>
                      </div>
                  )
                })}
              </div>

              <div className="text-xs text-muted-foreground flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-gradient-to-r from-blue-500 to-indigo-500" />
                {t("eventPage.legendMost")}
              </span>
                <span className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-muted" />
                  {t("eventPage.legendLeast")}
              </span>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setBestTimesOpen(false)}>
                {t("eventPage.close")}
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
}) {
  const { t } = useTranslations()

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
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{t("eventPage.you")}</div>
                    <div className="text-sm font-semibold truncate">{currentParticipant.name}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
        )}

        <Card className="shadow-sm border-border/50">
          <CardHeader className="p-3.5 pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Trophy className="h-4 w-4 text-yellow-500 shrink-0" /> {t("eventPage.bestTimes")}
            </CardTitle>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onOpenBestTimes}>
                <BarChart3 className="h-3.5 w-3.5 mr-1" />
                {t("eventPage.viewBestTimes")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3.5 pt-0 space-y-2.5">
            {bestTimes.length > 0 ? (
                bestTimes.map((time, i) => (
                    <div
                        key={i}
                        className="rounded-lg border bg-card p-2.5 space-y-1.5 shadow-sm hover:shadow transition-shadow"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-success truncate">{formatTimeInTz(time.slot)}</div>
                        <Badge variant="secondary" className="shrink-0 text-[10px] h-5 px-2 font-semibold">
                          {time.count}/{eventData.participants.length}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground line-clamp-1">{time.names.join(", ")}</div>
                    </div>
                ))
            ) : (
                <div className="text-xs text-muted-foreground text-center py-4">{t("eventPage.noOverlaps")}</div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50">
          <CardHeader className="p-3.5 pb-2">
            <CardTitle className="flex items-center justify-between text-base font-semibold">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0" /> {t("eventPage.participantsTitle")}
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
                            {t("eventPage.host")}
                          </Badge>
                      )}
                      {canRemove && (
                          <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleRemoveParticipant(p.id)}
                              title={t("eventPage.removeParticipant")}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                      )}
                    </div>
                )
              })}
            </div>
            {!isLoggedIn && (
                <Button className="w/full mt-1.5 bg-transparent" size="sm" variant="outline" onClick={() => router.push("/login")}>
                  <LogIn className="h-3 w-3 mr-1.5" />
                  {t("eventPage.signInRegister")}
                </Button>
            )}
            {isLoggedIn && !isParticipant && (
                <Button className="w-full mt-1.5" size="sm" onClick={handleJoin}>
                  {t("eventPage.joinEvent")}
                </Button>
            )}
          </CardContent>
        </Card>

        {isCreator && (
            <Card className="shadow-sm border-border/50">
              <CardHeader className="p-3.5 pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <UserPlus className="h-4 w-4 shrink-0" /> {t("eventPage.invite")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0">
                <div className="flex gap-1.5">
                  <Input
                      className="text-xs h-8"
                      placeholder={t("eventPage.usernamePlaceholder")}
                      value={inviteUsername}
                      onChange={(e) => setInviteUsername(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  />
                  <Button size="sm" onClick={handleInvite} className="shrink-0 h-8 px-3 text-xs">
                    {t("eventPage.invite")}
                  </Button>
                </div>
              </CardContent>
            </Card>
        )}
      </>
  )
}
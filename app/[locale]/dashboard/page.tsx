"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Link } from "@/src/i18n/navigation"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { format } from "date-fns"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { SignOut, Trash, Gear, Plus, ArrowLeft, Clock, Warning, X, Users, UserPlus, UserMinus, Envelope, Check, XCircle } from "phosphor-react"
import { useToast } from "@/hooks/use-toast"
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
import { fetchWithAuth, clearTokens, logout, ensureAuth } from "@/lib/api"
import { useTranslations } from "next-intl"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"

interface Event {
    id: string
    name: string
    dateRange?: {
        from: string
        to: string
    }
    duration?: number
    isOwner?: boolean
}

interface UserProfile {
    emailVerified: boolean
    verificationExpiry?: string
}

interface Friend {
    id: string
    username: string
}

interface FriendRequest {
    id: string
    senderId: string
    username: string
    createdAt: string
}

interface EventInvite {
    id: string
    eventId: string
    name: string
    dateRange: {
        from: string
        to: string
    }
    duration: number
    timezone: string
    disabledSlots: string[]
    inviterId: string
    inviterUsername: string
    createdAt: string
}

export default function Dashboard() {
    const [events, setEvents] = useState<Event[]>([])
    const [friends, setFriends] = useState<Friend[]>([])
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
    const [eventInvites, setEventInvites] = useState<EventInvite[]>([])
    const [loading, setLoading] = useState(true)
    const [username, setUsername] = useState("")
    const [emailVerified, setEmailVerified] = useState(true)
    const [verificationExpiry, setVerificationExpiry] = useState<string | null>(null)
    const [hideVerificationBanner, setHideVerificationBanner] = useState(false)
    const [friendUsername, setFriendUsername] = useState("")
    const [activeTab, setActiveTab] = useState<"events" | "friends" | "invites">("events")
    const tCommon = useTranslations("common")
    const tDashboard = useTranslations("dashboard")
    const router = useRouter()
    const { toast } = useToast()

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetchWithAuth(`${API_BASE}/users/me`, { method: "GET" })
                if (res.status === 401) {
                    clearTokens()
                    router.push("/login")
                    return
                }
                if (res.ok) {
                    const data: UserProfile & { verificationExpiry?: string } = await res.json()
                    setEmailVerified(!!data.emailVerified)
                    setVerificationExpiry(data.verificationExpiry || null)
                }
            } catch (e) {
                console.error("Failed to load profile", e)
            }
        }

        const fetchEvents = async () => {
            try {
                const res = await fetchWithAuth(`${API_BASE}/my-events`, { method: "GET" })
                if (res.status === 401) {
                    clearTokens()
                    router.push("/login")
                    return
                }
                if (res.ok) {
                    const data = await res.json()
                    setEvents(Array.isArray(data) ? data : [])
                } else {
                    setEvents([])
                }
            } catch (error) {
                console.error("Failed to load dashboard", error)
                setEvents([])
            } finally {
                setLoading(false)
            }
        }

        const fetchFriends = async () => {
            try {
                const res = await fetchWithAuth(`${API_BASE}/friends`, { method: "GET" })
                if (res.status === 401) {
                    clearTokens()
                    router.push("/login")
                    return
                }
                if (res.ok) {
                    const data = await res.json()
                    setFriends(Array.isArray(data) ? data : [])
                }
            } catch (error) {
                console.error("Failed to load friends", error)
            }
        }

        const fetchFriendRequests = async () => {
            try {
                const res = await fetchWithAuth(`${API_BASE}/friends/requests`, { method: "GET" })
                if (res.status === 401) {
                    clearTokens()
                    router.push("/login")
                    return
                }
                if (res.ok) {
                    const data = await res.json()
                    setFriendRequests(Array.isArray(data) ? data : [])
                }
            } catch (error) {
                console.error("Failed to load friend requests", error)
            }
        }

        const fetchEventInvites = async () => {
            try {
                const res = await fetchWithAuth(`${API_BASE}/events/invites`, { method: "GET" })
                if (res.status === 401) {
                    clearTokens()
                    router.push("/login")
                    return
                }
                if (res.ok) {
                    const data = await res.json()
                    setEventInvites(Array.isArray(data) ? data : [])
                }
            } catch (error) {
                console.error("Failed to load event invites", error)
            }
        }

        const init = async () => {
            const hasAuth = await ensureAuth()
            if (!hasAuth) {
                router.push("/login")
                return
            }

            const storedUsername = typeof window !== "undefined" && window.localStorage ? (window.localStorage.getItem("username") || "") : ""
            setUsername(storedUsername)

            fetchProfile()
            fetchEvents()
            fetchFriends()
            fetchFriendRequests()
            fetchEventInvites()
        }

        init()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const fetchFriends = async () => {
        try {
            const res = await fetchWithAuth(`${API_BASE}/friends`, { method: "GET" })
            if (res.status === 401) {
                clearTokens()
                router.push("/login")
                return
            }
            if (res.ok) {
                const data = await res.json()
                setFriends(Array.isArray(data) ? data : [])
            }
        } catch (error) {
            console.error("Failed to load friends", error)
        }
    }

    const fetchFriendRequests = async () => {
        try {
            const res = await fetchWithAuth(`${API_BASE}/friends/requests`, { method: "GET" })
            if (res.status === 401) {
                clearTokens()
                router.push("/login")
                return
            }
            if (res.ok) {
                const data = await res.json()
                setFriendRequests(Array.isArray(data) ? data : [])
            }
        } catch (error) {
            console.error("Failed to load friend requests", error)
        }
    }

    const fetchEventInvites = async () => {
        try {
            const res = await fetchWithAuth(`${API_BASE}/events/invites`, { method: "GET" })
            if (res.status === 401) {
                clearTokens()
                router.push("/login")
                return
            }
            if (res.ok) {
                const data = await res.json()
                setEventInvites(Array.isArray(data) ? data : [])
            }
        } catch (error) {
            console.error("Failed to load event invites", error)
        }
    }

    const handleLogout = async () => {
        await logout()
        router.push("/login")
    }

    const handleDelete = async (e: React.MouseEvent, eventId: string) => {
        e.stopPropagation()
        try {
            const res = await fetchWithAuth(`${API_BASE}/events/${eventId}`, { method: "DELETE" })
            if (res.status === 401) {
                clearTokens()
                router.push("/login")
                return
            }
            if (res.ok) {
                setEvents((prev) => prev.filter((ev) => ev.id !== eventId))
                toast({ title: tDashboard("toasts.eventDeletedTitle"), description: tDashboard("toasts.eventDeletedDescription") })
            } else {
                const data = await res.json().catch(() => ({}))
                toast({
                    title: tDashboard("toasts.errorTitle"),
                    description: data.error || tDashboard("toasts.deleteFailed"),
                    variant: "destructive",
                })
            }
        } catch (error) {
            console.error("Failed to delete", error)
            toast({ title: tDashboard("toasts.errorTitle"), description: tDashboard("toasts.unreachable"), variant: "destructive" })
        }
    }

    const handleLeaveEvent = async (e: React.MouseEvent, eventId: string) => {
        e.stopPropagation()
        try {
            const res = await fetchWithAuth(`${API_BASE}/events/${eventId}/leave`, { method: "POST" })
            if (res.status === 401) {
                clearTokens()
                router.push("/login")
                return
            }
            if (res.ok) {
                setEvents((prev) => prev.filter((ev) => ev.id !== eventId))
                toast({ title: tDashboard("toasts.leftEventTitle"), description: tDashboard("toasts.leftEventDescription") })
            } else {
                const data = await res.json().catch(() => ({}))
                toast({
                    title: tDashboard("toasts.errorTitle"),
                    description: data.error || tDashboard("toasts.leaveFailed"),
                    variant: "destructive",
                })
            }
        } catch (error) {
            console.error("Failed to leave event", error)
            toast({ title: tDashboard("toasts.errorTitle"), description: tDashboard("toasts.unreachable"), variant: "destructive" })
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
                toast({ title: tDashboard("toasts.verificationSentTitle"), description: tDashboard("toasts.verificationSentBody") })
            } else {
                toast({ title: tDashboard("toasts.errorTitle"), description: data.error || tDashboard("toasts.resendFailed"), variant: "destructive" })
            }
        } catch {
            toast({ title: tDashboard("toasts.errorTitle"), description: tDashboard("toasts.failedToConnect"), variant: "destructive" })
        }
    }

    const handleSendFriendRequest = async () => {
        if (!friendUsername.trim()) return
        try {
            const res = await fetchWithAuth(`${API_BASE}/friends/request`, {
                method: "POST",
                body: JSON.stringify({ username: friendUsername.trim() }),
            })
            const data = await res.json().catch(() => ({}))
            if (res.status === 401) {
                clearTokens()
                router.push("/login")
                return
            }
            if (res.ok) {
                toast({ title: tDashboard("toasts.friendRequestSentTitle"), description: tDashboard("toasts.friendRequestSentBody", { name: friendUsername }) })
                setFriendUsername("")
            } else {
                toast({ title: tDashboard("toasts.errorTitle"), description: data.error || tDashboard("toasts.friendRequestFailed"), variant: "destructive" })
            }
        } catch {
            toast({ title: tDashboard("toasts.errorTitle"), description: tDashboard("toasts.failedToConnect"), variant: "destructive" })
        }
    }

    const handleAcceptFriendRequest = async (requestId: string) => {
        try {
            const res = await fetchWithAuth(`${API_BASE}/friends/accept/${requestId}`, { method: "POST" })
            if (res.status === 401) {
                clearTokens()
                router.push("/login")
                return
            }
            if (res.ok) {
                toast({ title: tDashboard("toasts.friendRequestAccepted") })
                fetchFriendRequests()
                fetchFriends()
            } else {
                const data = await res.json().catch(() => ({}))
                toast({ title: tDashboard("toasts.errorTitle"), description: data.error || tDashboard("toasts.friendRequestAcceptFailed"), variant: "destructive" })
            }
        } catch {
            toast({ title: tDashboard("toasts.errorTitle"), description: tDashboard("toasts.failedToConnect"), variant: "destructive" })
        }
    }

    const handleDeclineFriendRequest = async (requestId: string) => {
        try {
            const res = await fetchWithAuth(`${API_BASE}/friends/decline/${requestId}`, { method: "POST" })
            if (res.status === 401) {
                clearTokens()
                router.push("/login")
                return
            }
            if (res.ok) {
                toast({ title: tDashboard("toasts.friendRequestDeclined") })
                fetchFriendRequests()
            } else {
                const data = await res.json().catch(() => ({}))
                toast({ title: tDashboard("toasts.errorTitle"), description: data.error || tDashboard("toasts.friendRequestDeclineFailed"), variant: "destructive" })
            }
        } catch {
            toast({ title: tDashboard("toasts.errorTitle"), description: tDashboard("toasts.failedToConnect"), variant: "destructive" })
        }
    }

    const handleRemoveFriend = async (friendId: string) => {
        try {
            const res = await fetchWithAuth(`${API_BASE}/friends/${friendId}`, { method: "DELETE" })
            if (res.status === 401) {
                clearTokens()
                router.push("/login")
                return
            }
            if (res.ok) {
                toast({ title: tDashboard("toasts.friendRemoved") })
                fetchFriends()
            } else {
                const data = await res.json().catch(() => ({}))
                toast({ title: tDashboard("toasts.errorTitle"), description: data.error || tDashboard("toasts.friendRemoveFailed"), variant: "destructive" })
            }
        } catch {
            toast({ title: tDashboard("toasts.errorTitle"), description: tDashboard("toasts.failedToConnect"), variant: "destructive" })
        }
    }

    const handleAcceptEventInvite = async (eventId: string) => {
        try {
            const res = await fetchWithAuth(`${API_BASE}/events/${eventId}/invite/accept`, { method: "POST" })
            if (res.status === 401) {
                clearTokens()
                router.push("/login")
                return
            }
            if (res.ok) {
                toast({ title: tDashboard("toasts.inviteAccepted") })
                fetchEventInvites()
            } else {
                const data = await res.json().catch(() => ({}))
                toast({ title: tDashboard("toasts.errorTitle"), description: data.error || tDashboard("toasts.inviteAcceptFailed"), variant: "destructive" })
            }
        } catch {
            toast({ title: tDashboard("toasts.errorTitle"), description: tDashboard("toasts.failedToConnect"), variant: "destructive" })
        }
    }

    const handleDeclineEventInvite = async (eventId: string) => {
        try {
            const res = await fetchWithAuth(`${API_BASE}/events/${eventId}/invite/decline`, { method: "POST" })
            if (res.status === 401) {
                clearTokens()
                router.push("/login")
                return
            }
            if (res.ok) {
                toast({ title: tDashboard("toasts.inviteDeclined") })
                fetchEventInvites()
            } else {
                const data = await res.json().catch(() => ({}))
                toast({ title: tDashboard("toasts.errorTitle"), description: data.error || tDashboard("toasts.inviteDeclineFailed"), variant: "destructive" })
            }
        } catch {
            toast({ title: tDashboard("toasts.errorTitle"), description: tDashboard("toasts.failedToConnect"), variant: "destructive" })
        }
    }

    const formatDurationText = (mins?: number) => {
        if (!mins || Number.isNaN(mins) || mins <= 0) return ""
        const h = Math.floor(mins / 60)
        const m = mins % 60
        const parts: string[] = []
        if (h > 0) parts.push(`${h} ${h === 1 ? tDashboard("duration.hour") : tDashboard("duration.hours")}`)
        if (m > 0) parts.push(`${m} ${m === 1 ? tDashboard("duration.minute") : tDashboard("duration.minutes")}`)
        return parts.join(" ")
    }

    const renderVerificationBanner = () => {
        if (emailVerified || hideVerificationBanner) return null
        return (
            <div className="w-full max-w-4xl mx-auto px-4 md:px-8">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-4 shadow-sm">
                    <div className="flex items-start gap-3 flex-1">
                        <Warning className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                        <div className="space-y-1">
                            <p className="font-semibold">{tDashboard("verification.title")}</p>
                            <p className="text-sm">
                                {tDashboard("verification.body")}
                                {verificationExpiry && (
                                    <span className="block text-xs text-amber-800 mt-1">
                                        {tDashboard("verification.expires")}: {new Date(verificationExpiry).toLocaleString()}
                                    </span>
                                )}
                            </p>
                            <div className="flex flex-wrap gap-2 pt-1">
                                <Button size="sm" variant="outline" className="border-amber-300 text-amber-900" onClick={handleResendVerification}>
                                    {tDashboard("verification.resend")}
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

    if (loading) return <div className="min-h-screen flex items-center justify-center">{tDashboard("loading")}</div>

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="w-full flex items-center justify-between">
                <Button variant="ghost" size="sm" className="gap-2" asChild>
                    <Link href="/">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="hidden md:inline">{tCommon("backToHome")}</span>
                        <span className="md:hidden">{tCommon("home")}</span>
                    </Link>
                </Button>

                <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground hidden sm:inline">
                        {tCommon("signedInAs", { name: username || tCommon("guest") })}
                    </span>

                    <Link href="/settings">
                        <Button variant="ghost" size="sm">
                            <Gear className="h-4 w-4" />
                        </Button>
                    </Link>

                    <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
                        <SignOut className="h-4 w-4" />
                        <span className="hidden md:inline">{tCommon("signOut")}</span>
                    </Button>
                    <ThemeToggle />
                </div>
            </div>

            <div className="space-y-4">
                {renderVerificationBanner()}

                {/* Main content */}
                <div className="w-full max-w-4xl mx-auto space-y-6 p-4 md:p-8">
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-bold">{tDashboard("title")}</h1>
                        <Button className="gap-2" asChild>
                            <Link href="/create">
                                <Plus className="h-4 w-4" />
                                <span className="hidden md:inline">{tDashboard("newEvent")}</span>
                                <span className="md:hidden">{tDashboard("newShort")}</span>
                            </Link>
                        </Button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 border-b">
                        <Button
                            variant={activeTab === "events" ? "default" : "ghost"}
                            onClick={() => setActiveTab("events")}
                            className="rounded-b-none"
                        >
                            {tDashboard("tabs.events")} {events.length > 0 && <Badge variant="secondary" className="ml-2">{events.length}</Badge>}
                        </Button>
                        <Button
                            variant={activeTab === "invites" ? "default" : "ghost"}
                            onClick={() => setActiveTab("invites")}
                            className="rounded-b-none"
                        >
                            {tDashboard("tabs.invites")} {eventInvites.length > 0 && <Badge variant="secondary" className="ml-2">{eventInvites.length}</Badge>}
                        </Button>
                        <Button
                            variant={activeTab === "friends" ? "default" : "ghost"}
                            onClick={() => setActiveTab("friends")}
                            className="rounded-b-none"
                        >
                            {tDashboard("tabs.friends")} {friendRequests.length > 0 && <Badge variant="destructive" className="ml-2">{friendRequests.length}</Badge>}
                        </Button>
                    </div>

                    {/* Events Tab */}
                    {activeTab === "events" && (
                        <>
                            {events.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <p>{tDashboard("empty")}</p>
                                    <Button variant="link" className="underline hover:text-primary" asChild>
                                        <Link href="/create">{tDashboard("emptyCta")}</Link>
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {events.map((event) => (
                                        <Card
                                            key={event.id}
                                            className="cursor-pointer hover:border-primary transition-colors"
                                            onClick={() => router.push(`/event/${event.id}`)} // singular route
                                        >
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                <CardTitle className="text-xl">{event.name}</CardTitle>

                                                <div className="flex items-center gap-2">
                                                    {/* If user is NOT the owner, show a Leave button */}
                                                    {!event.isOwner && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:bg-destructive/10"
                                                            onClick={(e) => handleLeaveEvent(e, event.id)}
                                                            title={tDashboard("leaveTitle")}
                                                        >
                                                            <SignOut className="h-4 w-4" />
                                                        </Button>
                                                    )}

                                                    {/* If user is the owner, show delete dialog as before */}
                                                    {event.isOwner && (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <Trash className="h-4 w-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>{tDashboard("deleteConfirmTitle")}</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        {tDashboard("deleteConfirmDescription", { name: event.name })}
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>{tDashboard("cancel")}</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                        onClick={(e) => handleDelete(e, event.id)}
                                                                    >
                                                                        {tDashboard("delete")}
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                {event.dateRange && (
                                                    <p className="text-sm text-muted-foreground flex items-center gap-3">
                                                        <span>
                                                            {format(new Date(event.dateRange.from), "MMM d")} - {format(new Date(event.dateRange.to), "MMM d, yyyy")}
                                                        </span>

                                                        {event.duration && (
                                                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                                                <Clock className="h-4 w-4" />
                                                                <span className="font-medium">{formatDurationText(event.duration)}</span>
                                                            </span>
                                                        )}
                                                    </p>
                                                )}

                                                {!event.dateRange && event.duration && (
                                                    <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
                                                        <Clock className="h-4 w-4" />
                                                        <span className="font-medium">{formatDurationText(event.duration)}</span>
                                                    </p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* Invites Tab */}
                    {activeTab === "invites" && (
                        <>
                            {eventInvites.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Envelope className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>{tDashboard("invites.empty")}</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {eventInvites.map((invite) => (
                                        <Card key={invite.id} className="hover:border-primary transition-colors">
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                <CardTitle className="text-xl">{invite.name}</CardTitle>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeclineEventInvite(invite.eventId)}
                                                        className="text-destructive hover:bg-destructive/10"
                                                    >
                                                        <XCircle className="h-4 w-4 mr-1" />
                                                        {tDashboard("invites.decline")}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => {
                                                            handleAcceptEventInvite(invite.eventId)
                                                            router.push(`/event/${invite.eventId}`)
                                                        }}
                                                    >
                                                        <Check className="h-4 w-4 mr-1" />
                                                        {tDashboard("invites.accept")}
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-sm text-muted-foreground">
                                                    {tDashboard("invites.invitedBy", { name: invite.inviterUsername })}
                                                </p>
                                                {invite.dateRange && (
                                                    <p className="text-sm text-muted-foreground flex items-center gap-3 mt-2">
                                                        <span>
                                                            {format(new Date(invite.dateRange.from), "MMM d")} - {format(new Date(invite.dateRange.to), "MMM d, yyyy")}
                                                        </span>
                                                        {invite.duration && (
                                                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                                                <Clock className="h-4 w-4" />
                                                                <span className="font-medium">{formatDurationText(invite.duration)}</span>
                                                            </span>
                                                        )}
                                                    </p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* Friends Tab */}
                    {activeTab === "friends" && (
                        <>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <UserPlus className="h-5 w-5" />
                                        {tDashboard("friends.addTitle")}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder={tDashboard("friends.placeholder")}
                                            value={friendUsername}
                                            onChange={(e) => setFriendUsername(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleSendFriendRequest()}
                                        />
                                        <Button onClick={handleSendFriendRequest}>{tDashboard("friends.sendRequest")}</Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {friendRequests.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Envelope className="h-5 w-5" />
                                            {tDashboard("friends.requestsTitle", { count: friendRequests.length })}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        {friendRequests.map((request) => (
                                            <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarFallback>{request.username[0].toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-medium">{request.username}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {format(new Date(request.createdAt), tDashboard("friends.dateFormat"))}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleDeclineFriendRequest(request.id)}
                                                    >
                                                        <XCircle className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="sm" onClick={() => handleAcceptFriendRequest(request.id)}>
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            )}

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Users className="h-5 w-5" />
                                        {tDashboard("friends.listTitle", { count: friends.length })}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {friends.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                            <p>{tDashboard("friends.emptyTitle")}</p>
                                            <p className="text-sm mt-2">{tDashboard("friends.emptySubtitle")}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {friends.map((friend) => (
                                                <div key={friend.id} className="flex items-center justify-between p-3 border rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarFallback>{friend.username[0].toUpperCase()}</AvatarFallback>
                                                        </Avatar>
                                                        <p className="font-medium">{friend.username}</p>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleRemoveFriend(friend.id)}
                                                        className="text-destructive hover:bg-destructive/10"
                                                    >
                                                        <UserMinus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}


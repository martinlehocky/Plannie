"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { format } from "date-fns"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import { Button } from "@/components/ui/button"
import { LogOut, Trash2, Settings, Plus, ArrowLeft, Clock } from "lucide-react"
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
import { fetchWithAuth, clearTokens, logout, getAccessToken, getStoredUsername } from "@/lib/api"
import { useTranslations } from "@/components/language-provider"

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

export default function Dashboard() {
    const [events, setEvents] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)
    const [username, setUsername] = useState("")
    const { t } = useTranslations()
    const router = useRouter()
    const { toast } = useToast()

    useEffect(() => {
        const token = getAccessToken()
        const storedUsername = getStoredUsername() || ""
        setUsername(storedUsername)

        if (!token) {
            router.push("/login")
            return
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

        fetchEvents()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

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
                toast({ title: t("dashboard.toasts.eventDeletedTitle"), description: t("dashboard.toasts.eventDeletedDescription") })
            } else {
                const data = await res.json().catch(() => ({}))
                toast({
                    title: t("dashboard.toasts.errorTitle"),
                    description: data.error || t("dashboard.toasts.deleteFailed"),
                    variant: "destructive",
                })
            }
        } catch (error) {
            console.error("Failed to delete", error)
            toast({ title: t("dashboard.toasts.errorTitle"), description: t("dashboard.toasts.unreachable"), variant: "destructive" })
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
                toast({ title: t("dashboard.toasts.leftEventTitle"), description: t("dashboard.toasts.leftEventDescription") })
            } else {
                const data = await res.json().catch(() => ({}))
                toast({
                    title: t("dashboard.toasts.errorTitle"),
                    description: data.error || t("dashboard.toasts.leaveFailed"),
                    variant: "destructive",
                })
            }
        } catch (error) {
            console.error("Failed to leave event", error)
            toast({ title: t("dashboard.toasts.errorTitle"), description: t("dashboard.toasts.unreachable"), variant: "destructive" })
        }
    }

    const formatDurationText = (mins?: number) => {
        if (!mins || Number.isNaN(mins) || mins <= 0) return ""
        const h = Math.floor(mins / 60)
        const m = mins % 60
        const parts: string[] = []
        if (h > 0) parts.push(`${h} ${h === 1 ? t("dashboard.duration.hour") : t("dashboard.duration.hours")}`)
        if (m > 0) parts.push(`${m} ${m === 1 ? t("dashboard.duration.minute") : t("dashboard.duration.minutes")}`)
        return parts.join(" ")
    }

    if (loading) return <div className="min-h-screen flex items-center justify-center">{t("dashboard.loading")}</div>

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="w-full flex justify-between items-center gap-2 p-4">
                <Button variant="ghost" size="sm" className="gap-2" asChild>
                    <Link href="/">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="hidden md:inline">{t("common.backToHome")}</span>
                        <span className="md:hidden">{t("common.home")}</span>
                    </Link>
                </Button>

                <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {t("common.signedInAs", { name: username || t("common.guest") })}
          </span>

                    <Link href="/settings">
                        <Button variant="ghost" size="sm">
                            <Settings className="h-4 w-4" />
                        </Button>
                    </Link>

                    <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
                        <LogOut className="h-4 w-4" />
                        <span className="hidden md:inline">{t("common.signOut")}</span>
                    </Button>
                    <LanguageToggle className="w-[150px]" />
                    <ThemeToggle />
                </div>
            </div>

            {/* Main content */}
            <div className="w-full max-w-4xl mx-auto space-y-6 p-4 md:p-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">{t("dashboard.myEvents")}</h1>
                    <Button className="gap-2" asChild>
                        <Link href="/create">
                            <Plus className="h-4 w-4" />
                            <span className="hidden md:inline">{t("dashboard.newEvent")}</span>
                            <span className="md:hidden">{t("dashboard.newShort")}</span>
                        </Link>
                    </Button>
                </div>

                {events.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <p>{t("dashboard.empty")}</p>
                        <Button variant="link" className="underline hover:text-primary" asChild>
                            <Link href="/create">{t("dashboard.emptyCta")}</Link>
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
                                                title={t("dashboard.leaveTitle")}
                                            >
                                                <LogOut className="h-4 w-4" />
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
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                                        <AlertDialogHeader>
                                                        <AlertDialogTitle>{t("dashboard.deleteConfirmTitle")}</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                             {t("dashboard.deleteConfirmDescription", { name: event.name })}
                                                         </AlertDialogDescription>
                                                     </AlertDialogHeader>
                                                     <AlertDialogFooter>
                                                         <AlertDialogCancel>{t("dashboard.cancel")}</AlertDialogCancel>
                                                         <AlertDialogAction
                                                             className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                             onClick={(e) => handleDelete(e, event.id)}
                                                         >
                                                             {t("dashboard.delete")}
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
            </div>
        </div>
    )
}

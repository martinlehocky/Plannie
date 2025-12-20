"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { format } from "date-fns"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { LogOut, Trash2, Settings, Plus, ArrowLeft } from "lucide-react"
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"

interface Event {
    id: string
    name: string
    dateRange?: {
        from: string
        to: string
    }
    isOwner?: boolean
}

export default function Dashboard() {
    const [events, setEvents] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)
    const [username, setUsername] = useState("")
    const router = useRouter()
    const { toast } = useToast()

    useEffect(() => {
        const token = localStorage.getItem("token")
        const storedUsername = localStorage.getItem("username") || ""
        setUsername(storedUsername)

        if (!token) {
            router.push("/login")
            return
        }

        const fetchEvents = async () => {
            try {
                const res = await fetch(`${API_BASE}/my-events`, {
                    headers: { Authorization: `Bearer ${token}` },
                })
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

    const handleLogout = () => {
        localStorage.removeItem("token")
        localStorage.removeItem("username")
        router.push("/login")
    }

    const handleDelete = async (e: React.MouseEvent, eventId: string) => {
        e.stopPropagation()
        const token = localStorage.getItem("token")
        if (!token) {
            router.push("/login")
            return
        }
        try {
            const res = await fetch(`${API_BASE}/events/${eventId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            })

            if (res.ok) {
                setEvents(events.filter((ev) => ev.id !== eventId))
                toast({ title: "Event deleted", description: "The event has been permanently removed." })
            } else {
                const data = await res.json()
                toast({ title: "Error", description: data.error, variant: "destructive" })
            }
        } catch (error) {
            console.error("Failed to delete", error)
            toast({ title: "Error", description: "Could not reach the server.", variant: "destructive" })
        }
    }

    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading dashboard...</div>

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="w-full flex justify-between items-center gap-2 p-4">
                {/* Back to Home button on the left */}
                <Button variant="ghost" size="sm" className="gap-2" asChild>
                    <Link href="/">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="hidden md:inline">Back to Home</span>
                        <span className="md:hidden">Home</span>
                    </Link>
                </Button>

                {/* Right-side controls */}
                <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            Signed in as <span className="font-semibold text-foreground">{username || "you"}</span>
          </span>

                    <Link href="/settings">
                        <Button variant="ghost" size="sm">
                            <Settings className="h-4 w-4" />
                        </Button>
                    </Link>

                    <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
                        <LogOut className="h-4 w-4" />
                        <span className="hidden md:inline">Sign Out</span>
                    </Button>
                    <ThemeToggle />
                </div>
            </div>

            {/* Main content */}
            <div className="w-full max-w-4xl mx-auto space-y-6 p-4 md:p-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">My Events</h1>
                    <Button className="gap-2" asChild>
                        <Link href="/create">
                            <Plus className="h-4 w-4" />
                            <span className="hidden md:inline">New Event</span>
                            <span className="md:hidden">New</span>
                        </Link>
                    </Button>
                </div>

                {events.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <p>No events found.</p>
                        <Button variant="link" className="underline hover:text-primary" asChild>
                            <Link href="/create">Create your first event</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {events.map((event) => (
                            <Card
                                key={event.id}
                                className="cursor-pointer hover:border-primary transition-colors"
                                onClick={() => router.push(`/event/${event.id}`)}
                            >
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-xl">{event.name}</CardTitle>
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
                                                    <AlertDialogTitle>Delete Event?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This action cannot be undone. This will permanently delete "{event.name}" for all participants.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        onClick={(e) => handleDelete(e, event.id)}
                                                    >
                                                        Delete
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    {event.dateRange && (
                                        <p className="text-sm text-muted-foreground">
                                            {format(new Date(event.dateRange.from), "MMM d")} - {format(new Date(event.dateRange.to), "MMM d, yyyy")}
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
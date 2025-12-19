"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { format } from "date-fns"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { LogOut, Trash2, Settings, Plus } from "lucide-react" // Added Plus icon
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

export default function Dashboard() {
    const [events, setEvents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const { toast } = useToast()

    useEffect(() => {
        const userId = localStorage.getItem("userId")
        if (!userId) {
            router.push("/login")
            return
        }

        const fetchEvents = async () => {
            try {
                const res = await fetch("http://localhost:8080/my-events", {
                    headers: { "Authorization": userId }
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
    }, [])

    const handleLogout = () => {
        localStorage.removeItem("userId")
        localStorage.removeItem("username")
        router.push("/login")
    }

    const handleDelete = async (e: React.MouseEvent, eventId: string) => {
        e.stopPropagation()

        try {
            const userId = localStorage.getItem("userId")
            const res = await fetch(`http://localhost:8080/events/${eventId}`, {
                method: "DELETE",
                headers: { "Authorization": userId || "" }
            })

            if (res.ok) {
                setEvents(events.filter(ev => ev.id !== eventId))
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

    if (loading) return <div className="p-8 text-center">Loading dashboard...</div>

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 relative">
            <div className="absolute top-4 right-4 md:top-8 md:right-8 flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => router.push("/settings")}>
                    <Settings className="h-4 w-4" />
                </Button>

                <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
                    <LogOut className="h-4 w-4" />
                    Sign Out
                </Button>
                <ThemeToggle />
            </div>

            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">My Events</h1>
                    {/* Create New Event Button */}
                    <Button onClick={() => router.push("/")} className="gap-2">
                        <Plus className="h-4 w-4" /> New Event
                    </Button>
                </div>

                <div className="grid gap-4">
                    {events.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                            <p className="mb-4">No events found.</p>
                            <button onClick={() => router.push("/")} className="underline hover:text-primary">
                                Create your first event
                            </button>
                        </div>
                    ) : (
                        events.map((event) => (
                            <Card
                                key={event.id}
                                className="cursor-pointer hover:border-primary transition-colors relative group"
                                onClick={() => router.push(`/event/${event.id}`)}
                            >
                                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                                    <CardTitle className="text-xl pr-8">{event.name}</CardTitle>

                                    {event.isOwner && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Event?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This action cannot be undone. This will permanently delete
                                                        "{event.name}" for all participants.
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
                                        <p className="text-muted-foreground">
                                            {format(new Date(event.dateRange.from), "MMM d")} - {format(new Date(event.dateRange.to), "MMM d, yyyy")}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Clock, Users, Share2, Sparkles, Zap } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { logout, getAccessToken, getStoredUsername } from "@/lib/api"

export default function LandingPage() {
    const router = useRouter()
    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [username, setUsername] = useState("")

    useEffect(() => {
        const token = getAccessToken()
        const storedUsername = getStoredUsername() || ""
        setIsLoggedIn(!!token)
        setUsername(storedUsername)
    }, [])

    const handleSignOut = async () => {
        await logout()
        setIsLoggedIn(false)
        setUsername("")
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-primary-foreground" />
                        </div>
                        <span className="font-bold text-xl">Plannie</span>
                    </div>

                    <div className="flex items-center gap-3">
                        {isLoggedIn && (
                            <span className="text-sm text-muted-foreground hidden sm:inline">
                Signed in as <span className="font-semibold text-foreground">{username || "you"}</span>
              </span>
                        )}

                        {isLoggedIn && (
                            <Link href="/dashboard">
                                <Button variant="outline" size="sm" className="font-semibold">
                                    My Dashboard
                                </Button>
                            </Link>
                        )}

                        <Link href="/create">
                            <Button size="sm" className="font-semibold">
                                Create Event
                            </Button>
                        </Link>

                        {isLoggedIn ? (
                            <Button variant="ghost" size="sm" className="font-semibold" onClick={handleSignOut}>
                                Sign Out
                            </Button>
                        ) : (
                            <Link href="/login">
                                <Button variant="ghost" size="sm" className="font-semibold">
                                    Sign In / Register
                                </Button>
                            </Link>
                        )}

                        <ThemeToggle />
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="pt-32 pb-16 px-4">
                <div className="container mx-auto max-w-6xl text-center space-y-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-sm font-medium">Modern Group Scheduling</span>
                    </div>

                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-balance">
                        Find the Perfect Time
                        <br />
                        <span className="text-primary">Everyone Can Meet</span>
                    </h1>

                    <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
                        Coordinate meetings effortlessly. Select your availability, share a link, and watch as the best times emerge
                        through beautiful heatmap visualization.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                        <Link href="/create">
                            <Button size="lg" className="h-14 px-8 text-lg font-semibold">
                                <Calendar className="w-5 h-5 mr-2" />
                                Create Free Event
                            </Button>
                        </Link>
                        <Button variant="outline" size="lg" className="h-14 px-8 text-lg font-semibold bg-transparent" asChild>
                            <a href="#features">Learn More</a>
                        </Button>
                    </div>

                    <p className="text-sm text-muted-foreground">No sign-up required • Free forever • Works on any device</p>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-16 px-4">
                <div className="container mx-auto max-w-6xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-5xl font-bold mb-4">Why Choose Plannie?</h2>
                        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                            Built for teams, clubs, friends, and anyone who needs to coordinate schedules without the hassle.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Card className="border-2 hover:shadow-xl transition-all duration-300 hover:border-primary/50">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <Zap className="w-6 h-6 text-primary" />
                                </div>
                                <CardTitle className="text-xl">Lightning Fast</CardTitle>
                                <CardDescription className="text-base">
                                    Create events in seconds. No complicated setup or lengthy forms. Just pick dates and share.
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="border-2 hover:shadow-xl transition-all duration-300 hover:border-primary/50">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <Users className="w-6 h-6 text-primary" />
                                </div>
                                <CardTitle className="text-xl">Visual Heatmap</CardTitle>
                                <CardDescription className="text-base">
                                    See group availability at a glance with our intuitive heatmap. Darker colors mean more people available.
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="border-2 hover:shadow-xl transition-all duration-300 hover:border-primary/50">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <Share2 className="w-6 h-6 text-primary" />
                                </div>
                                <CardTitle className="text-xl">Easy Sharing</CardTitle>
                                <CardDescription className="text-base">
                                    Share a simple link with your group. No accounts needed, works on any device, anywhere.
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="border-2 hover:shadow-xl transition-all duration-300 hover:border-primary/50">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <Calendar className="w-6 h-6 text-primary" />
                                </div>
                                <CardTitle className="text-xl">Smart Dates</CardTitle>
                                <CardDescription className="text-base">
                                    Automatically expands to show all dates you need. Add more dates dynamically as needed.
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="border-2 hover:shadow-xl transition-all duration-300 hover:border-primary/50">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <Clock className="w-6 h-6 text-primary" />
                                </div>
                                <CardTitle className="text-xl">Time Zones</CardTitle>
                                <CardDescription className="text-base">
                                    Automatically handles time zones. Everyone sees times in their local time zone.
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="border-2 hover:shadow-xl transition-all duration-300 hover:border-primary/50">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <Sparkles className="w-6 h-6 text-primary" />
                                </div>
                                <CardTitle className="text-xl">Modern Design</CardTitle>
                                <CardDescription className="text-base">
                                    Beautiful, mobile-responsive interface with dark mode support. Looks great everywhere.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-16 px-4 bg-muted/30">
                <div className="container mx-auto max-w-4xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-5xl font-bold mb-4">How It Works</h2>
                        <p className="text-muted-foreground text-lg">Getting started takes less than a minute</p>
                    </div>

                    <div className="space-y-8">
                        <div className="flex gap-6 items-start">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                                1
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2">Create Your Event</h3>
                                <p className="text-muted-foreground">
                                    Give your event a name, select the date range, and set the meeting duration. That's it!
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-6 items-start">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                                2
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2">Share the Link</h3>
                                <p className="text-muted-foreground">
                                    Copy the event link and share it with your group via email, Slack, WhatsApp, or any messaging app.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-6 items-start">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                                3
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2">Select Availability</h3>
                                <p className="text-muted-foreground">
                                    Each person clicks and drags to mark when they're available. Changes are saved automatically.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-6 items-start">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                                4
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2">Find Best Time</h3>
                                <p className="text-muted-foreground">
                                    Watch the heatmap update in real-time. Darker times mean more people available. Pick the best time!
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-4">
                <div className="container mx-auto max-w-4xl text-center">
                    <Card className="border-2 shadow-2xl bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                        <CardContent className="pt-12 pb-12 space-y-6">
                            <h2 className="text-3xl md:text-5xl font-bold text-balance">Ready to Schedule Your Next Meeting?</h2>
                            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                                Join thousands of teams coordinating schedules with Plannie. No credit card required.
                            </p>
                            <Link href="/create">
                                <Button size="lg" className="h-14 px-10 text-lg font-semibold">
                                    <Calendar className="w-5 h-5 mr-2" />
                                    Create Your First Event
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t py-8 px-4">
                <div className="container mx-auto text-center text-sm text-muted-foreground">
                    <p>Made with ❤️ for better scheduling</p>
                </div>
            </footer>
        </div>
    )
}
"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Link } from "@/src/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, Users, ShareNetwork, Sparkle, Lightning, X, Barbell, Globe, Heart, BookOpen, List as Menu, GridFour, CalendarCheck, ArrowRight } from "phosphor-react"
import { logout, getStoredUsername, ensureAuth } from "@/lib/api"
import { useTranslations } from "next-intl"
import { useInView } from "@/hooks/use-in-view"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"

const FadeIn = ({
                    children,
                    className,
                    delay = 0,
                    isAlwaysInView = false,
                }: {
    children: React.ReactNode
    className?: string
    delay?: number
    isAlwaysInView?: boolean
}) => {
    const { ref, isInView } = useInView({ threshold: 0.1 })
    const show = isAlwaysInView || isInView
    return (
        <div
            ref={ref}
            className={cn(
                "transition-all duration-700 ease-out transform opacity-0 translate-y-8",
                show && "opacity-100 translate-y-0",
                className
            )}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    )
}

export default function LandingPage() {
    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [username, setUsername] = useState("")
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const tCommon = useTranslations("common")
    const tLanding = useTranslations("landing")

    // Animation mount check
    const [mounted, setMounted] = useState(false)
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        setMounted(true)

        const handleScroll = () => {
            setScrolled(window.scrollY > 20)
        }

        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    useEffect(() => {
        const init = async () => {
            const hasAuth = await ensureAuth()
            setIsLoggedIn(hasAuth)
            const storedUsername = getStoredUsername() || ""
            setUsername(storedUsername)
        }
        init()
    }, [])

    const handleSignOut = async () => {
        await logout()
        setIsLoggedIn(false)
        setUsername("")
        setIsMenuOpen(false)
    }

    return (
        <main className="relative w-full min-h-screen bg-background">
            {/* Header with glass morphism */}
            <header
                className={cn(
                    "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
                    scrolled
                        ? "glass backdrop-blur-xl border-b border-border/50"
                        : "bg-transparent border-b border-transparent"
                )}
            >
                <div className="container mx-auto px-4 h-16 flex items-center justify-between relative">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center overflow-hidden">
                            <span className="text-primary-foreground font-bold text-lg">P</span>
                        </div>
                        <span className="font-bold text-xl">{tCommon("appName")}</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-6">
                        <a href="#features-section" className="text-sm font-medium hover:text-primary transition-colors">
                            Features
                        </a>
                        <a href="#use-cases-section" className="text-sm font-medium hover:text-primary transition-colors">
                            Use Cases
                        </a>
                        <a href="#how-it-works-section" className="text-sm font-medium hover:text-primary transition-colors">
                            How it Works
                        </a>
                    </nav>

                    {/* Desktop actions */}
                    <div className="hidden md:flex items-center gap-3">
                        {isLoggedIn && (
                            <>
                                <span className="text-sm text-muted-foreground">
                                    {tCommon("signedInAs", { name: username || tCommon("guest") })}
                                </span>
                                <Link href="/dashboard">
                                    <Button variant="outline" size="sm" className="font-semibold">
                                        {tCommon("myDashboard")}
                                    </Button>
                                </Link>
                            </>
                        )}

                        <ThemeToggle />

                        <Link href="/create">
                            <Button size="sm" className="font-semibold">
                                {tCommon("createEvent")}
                            </Button>
                        </Link>

                        {isLoggedIn ? (
                            <Button variant="ghost" size="sm" className="font-semibold" onClick={handleSignOut}>
                                {tCommon("signOut")}
                            </Button>
                        ) : (
                            <Link href="/login">
                                <Button variant="ghost" size="sm" className="font-semibold">
                                    {tCommon("signInRegister")}
                                </Button>
                            </Link>
                        )}
                    </div>

                    {/* Mobile toggle */}
                    <div className="md:hidden flex items-center gap-2">
                        <ThemeToggle />
                        <Button
                            variant="outline"
                            size="icon"
                            className="rounded-lg"
                            onClick={() => setIsMenuOpen((prev) => !prev)}
                            aria-label="Toggle menu"
                        >
                            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </Button>
                    </div>

                    {/* Mobile menu */}
                    {isMenuOpen && (
                        <div className="absolute top-16 inset-x-0 px-4 md:hidden">
                            <div className="glass rounded-xl shadow-lg p-4 space-y-3">
                                <nav className="space-y-2 pb-3 border-b border-border/50">
                                    <a 
                                        href="#features-section" 
                                        className="block py-2 text-sm font-medium hover:text-primary transition-colors"
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        Features
                                    </a>
                                    <a 
                                        href="#use-cases-section" 
                                        className="block py-2 text-sm font-medium hover:text-primary transition-colors"
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        Use Cases
                                    </a>
                                    <a 
                                        href="#how-it-works-section" 
                                        className="block py-2 text-sm font-medium hover:text-primary transition-colors"
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        How it Works
                                    </a>
                                </nav>

                                {isLoggedIn && (
                                    <p className="text-sm text-muted-foreground">
                                        {tCommon("signedInAs", { name: username || tCommon("guest") })}
                                    </p>
                                )}

                                {isLoggedIn && (
                                    <Link href="/dashboard" onClick={() => setIsMenuOpen(false)}>
                                        <Button variant="outline" className="w-full justify-center">
                                            {tCommon("myDashboard")}
                                        </Button>
                                    </Link>
                                )}

                                <Link href="/create" onClick={() => setIsMenuOpen(false)}>
                                    <Button className="w-full justify-center">{tCommon("createEvent")}</Button>
                                </Link>

                                {isLoggedIn ? (
                                    <Button variant="ghost" className="w-full justify-center" onClick={handleSignOut}>
                                        {tCommon("signOut")}
                                    </Button>
                                ) : (
                                    <Link href="/login" onClick={() => setIsMenuOpen(false)}>
                                        <Button variant="ghost" className="w-full justify-center">
                                            {tCommon("signInRegister")}
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Hero Section with Gradient Blobs */}
            <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
                {/* Gradient blob backgrounds */}
                <div className="gradient-blob w-96 h-96 bg-primary/30 top-20 left-10" style={{ animationDelay: '0s' }} />
                <div className="gradient-blob w-80 h-80 bg-violet-500/20 top-40 right-20" style={{ animationDelay: '2s' }} />
                <div className="gradient-blob w-72 h-72 bg-purple-400/20 bottom-40 left-1/3" style={{ animationDelay: '4s' }} />

                <div className="container mx-auto px-4 py-20 relative z-10">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            {/* Left column - Text content */}
                            <div className="text-center lg:text-left space-y-6">
                                {/* Badge */}
                                <div
                                    className={cn(
                                        "inline-flex items-center gap-2 px-3 py-1 rounded-full glass border-primary/20 transition-all duration-1000 ease-out transform",
                                        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                                    )}
                                >
                                    <Sparkle className="w-4 h-4 text-primary" weight="fill" />
                                    <span className="text-sm font-medium">{tLanding("badge")}</span>
                                </div>

                                {/* Main headline with gradient */}
                                <h1
                                    className={cn(
                                        "text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight transition-all duration-1000 delay-100 ease-out transform",
                                        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                                    )}
                                >
                                    Find the Perfect Time{" "}
                                    <span className="text-gradient">Everyone Can Meet</span>
                                </h1>

                                {/* Subtitle */}
                                <p
                                    className={cn(
                                        "text-lg md:text-xl text-muted-foreground max-w-2xl transition-all duration-1000 delay-200 ease-out transform",
                                        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                                    )}
                                >
                                    {tLanding("description")}
                                </p>

                                {/* CTA Buttons */}
                                <div
                                    className={cn(
                                        "flex flex-col sm:flex-row gap-4 items-center lg:items-start justify-center lg:justify-start pt-2 transition-all duration-1000 delay-300 ease-out transform",
                                        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                                    )}
                                >
                                    <Link href="/create">
                                        <Button size="lg" className="h-14 px-8 text-lg font-semibold group">
                                            <Calendar className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                                            {tLanding("primaryCta")}
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        className="h-14 px-8 text-lg font-semibold"
                                        asChild
                                    >
                                        <a href="#features-section">{tLanding("secondaryCta")}</a>
                                    </Button>
                                </div>

                                {/* Note text */}
                                <p
                                    className={cn(
                                        "text-sm text-muted-foreground transition-all duration-1000 delay-400 ease-out transform",
                                        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                                    )}
                                >
                                    {tLanding("heroNote")}
                                </p>
                            </div>

                            {/* Right column - Interactive Heatmap Demo */}
                            <div
                                className={cn(
                                    "relative transition-all duration-1000 delay-200 ease-out transform",
                                    mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
                                )}
                            >
                                {/* Floating decorative blur circles */}
                                <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl animate-pulse" />
                                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-violet-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

                                {/* Browser window mockup */}
                                <div className="relative glass rounded-2xl p-4 shadow-2xl">
                                    {/* Browser controls */}
                                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
                                        <div className="w-3 h-3 rounded-full bg-red-500" />
                                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                        <div className="w-3 h-3 rounded-full bg-green-500" />
                                        <div className="flex-1 text-center text-xs text-muted-foreground font-mono">
                                            plannie.com/event/demo
                                        </div>
                                    </div>

                                    {/* Heatmap grid */}
                                    <div className="bg-card/50 rounded-xl p-4">
                                        <div className="text-sm font-semibold mb-3">Team Availability</div>
                                        <div className="grid grid-cols-6 gap-2">
                                            {/* Header row - Days */}
                                            <div className="text-xs font-medium text-muted-foreground" />
                                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
                                                <div key={day} className="text-xs font-medium text-center text-muted-foreground">
                                                    {day}
                                                </div>
                                            ))}

                                            {/* Time rows */}
                                            {['9 AM', '10 AM', '11 AM', '12 PM'].map((time, timeIdx) => (
                                                <>
                                                    <div key={time} className="text-xs font-medium text-muted-foreground flex items-center">
                                                        {time}
                                                    </div>
                                                    {[0, 1, 2, 3, 4].map((dayIdx) => {
                                                        // Predetermined demo availability data for consistent rendering
                                                        const demoData = [
                                                            [3, 4, 2, 3, 4], // 9 AM
                                                            [2, 3, 6, 4, 5], // 10 AM - Wed is best time (6/6)
                                                            [4, 2, 3, 2, 1], // 11 AM
                                                            [5, 5, 4, 3, 2], // 12 PM
                                                        ]
                                                        const availability = demoData[timeIdx][dayIdx]
                                                        const intensity = availability / 6
                                                        const bgColor = `rgba(124, 58, 237, ${intensity * 0.7})`
                                                        
                                                        return (
                                                            <div
                                                                key={`${timeIdx}-${dayIdx}`}
                                                                className="heatmap-cell aspect-square rounded-md relative group"
                                                                style={{ backgroundColor: bgColor }}
                                                            >
                                                                {/* Tooltip on hover */}
                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                                    {availability}/6 Available
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </>
                                            ))}
                                        </div>

                                        {/* Success notification badge */}
                                        <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
                                            <CalendarCheck className="w-5 h-5 text-primary" weight="fill" />
                                            <span className="text-sm font-medium">Best time found! Wed, 10:00 AM</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section - Why Choose Plannie? */}
            <section id="features-section" className="py-20 px-4 bg-muted/30">
                <div className="container mx-auto max-w-7xl">
                    <FadeIn>
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-5xl font-bold mb-4">{tLanding("whyTitle")}</h2>
                            <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
                                {tLanding("whySubtitle")}
                            </p>
                        </div>
                    </FadeIn>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <FadeIn delay={100}>
                            <Card className="glass hover:border-primary/50 transition-all duration-300 h-full group">
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <Lightning className="w-6 h-6 text-primary" weight="fill" />
                                    </div>
                                    <CardTitle className="text-xl">{tLanding("features.lightning.title")}</CardTitle>
                                    <CardDescription className="text-base">
                                        {tLanding("features.lightning.description")}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </FadeIn>

                        <FadeIn delay={200}>
                            <Card className="glass hover:border-primary/50 transition-all duration-300 h-full group">
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <GridFour className="w-6 h-6 text-primary" weight="fill" />
                                    </div>
                                    <CardTitle className="text-xl">{tLanding("features.heatmap.title")}</CardTitle>
                                    <CardDescription className="text-base">
                                        {tLanding("features.heatmap.description")}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </FadeIn>

                        <FadeIn delay={300}>
                            <Card className="glass hover:border-primary/50 transition-all duration-300 h-full group">
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <ShareNetwork className="w-6 h-6 text-primary" weight="fill" />
                                    </div>
                                    <CardTitle className="text-xl">{tLanding("features.sharing.title")}</CardTitle>
                                    <CardDescription className="text-base">
                                        {tLanding("features.sharing.description")}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </FadeIn>

                        <FadeIn delay={400}>
                            <Card className="glass hover:border-primary/50 transition-all duration-300 h-full group">
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <Calendar className="w-6 h-6 text-primary" weight="fill" />
                                    </div>
                                    <CardTitle className="text-xl">{tLanding("features.smartDates.title")}</CardTitle>
                                    <CardDescription className="text-base">
                                        {tLanding("features.smartDates.description")}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </FadeIn>

                        <FadeIn delay={500}>
                            <Card className="glass hover:border-primary/50 transition-all duration-300 h-full group">
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <Clock className="w-6 h-6 text-primary" weight="fill" />
                                    </div>
                                    <CardTitle className="text-xl">{tLanding("features.timezones.title")}</CardTitle>
                                    <CardDescription className="text-base">
                                        {tLanding("features.timezones.description")}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </FadeIn>

                        <FadeIn delay={600}>
                            <Card className="glass hover:border-primary/50 transition-all duration-300 h-full group">
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <Sparkle className="w-6 h-6 text-primary" weight="fill" />
                                    </div>
                                    <CardTitle className="text-xl">{tLanding("features.design.title")}</CardTitle>
                                    <CardDescription className="text-base">
                                        {tLanding("features.design.description")}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </FadeIn>
                    </div>
                </div>
            </section>

            {/* Use Cases Section */}
            <section id="use-cases-section" className="py-20 bg-background overflow-hidden">
                <div className="container mx-auto max-w-7xl px-4 mb-12">
                    <FadeIn>
                        <h2 className="text-3xl md:text-5xl font-bold text-center mb-4">
                            {tLanding("useCases.title")}
                        </h2>
                        <p className="text-muted-foreground text-lg text-center max-w-2xl mx-auto">
                            {tLanding("useCasesSubtitle")}
                        </p>
                    </FadeIn>
                </div>

                {/* Marquee Container */}
                <div className="relative w-full">
                    {/* Gradient overlays */}
                    <div className="absolute left-0 top-0 bottom-0 w-24 md:w-40 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
                    <div className="absolute right-0 top-0 bottom-0 w-24 md:w-40 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

                    <FadeIn delay={100}>
                        <div className="flex animate-marquee">
                            {/* First set of cards */}
                            {[
                                {
                                    icon: BookOpen,
                                    title: tLanding("useCases.study.title"),
                                    description: tLanding("useCases.study.description"),
                                    image: "/images/use-cases/study.jpg",
                                },
                                {
                                    icon: Users,
                                    title: tLanding("useCases.clients.title"),
                                    description: tLanding("useCases.clients.description"),
                                    image: "/images/use-cases/clients.jpg",
                                },
                                {
                                    icon: Barbell,
                                    title: tLanding("useCases.fitness.title"),
                                    description: tLanding("useCases.fitness.description"),
                                    image: "/images/use-cases/fitness.jpg",
                                },
                                {
                                    icon: Heart,
                                    title: tLanding("useCases.social.title"),
                                    description: tLanding("useCases.social.description"),
                                    image: "/images/use-cases/social.jpg",
                                },
                                {
                                    icon: Globe,
                                    title: tLanding("useCases.remote.title"),
                                    description: tLanding("useCases.remote.description"),
                                    image: "/images/use-cases/remote.jpg",
                                },
                                {
                                    icon: Users,
                                    title: tLanding("useCases.community.title"),
                                    description: tLanding("useCases.community.description"),
                                    image: "/images/use-cases/community.jpg",
                                },
                                {
                                    icon: Lightning,
                                    title: tLanding("useCases.workshops.title"),
                                    description: tLanding("useCases.workshops.description"),
                                    image: "/images/use-cases/workshops.jpg",
                                },
                            ].map((useCase, index) => (
                                <div key={index} className="shrink-0 w-72 md:w-80 mx-4">
                                    <Card className="group relative overflow-hidden h-96 glass hover:border-primary/50 transition-all duration-300">
                                        <div className="absolute inset-0">
                                            <Image
                                                src={useCase.image}
                                                alt={useCase.title}
                                                fill
                                                sizes="(max-width: 768px) 288px, 320px"
                                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                                loading="lazy"
                                                quality={75}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                                        </div>
                                        <CardContent className="absolute bottom-0 left-0 right-0 p-6 text-white">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-10 h-10 rounded-lg bg-primary/20 backdrop-blur-sm flex items-center justify-center">
                                                    <useCase.icon className="w-5 h-5" weight="fill" />
                                                </div>
                                                <h3 className="text-xl font-bold">{useCase.title}</h3>
                                            </div>
                                            <p className="text-sm text-white/80 line-clamp-2">{useCase.description}</p>
                                        </CardContent>
                                    </Card>
                                </div>
                            ))}

                            {/* Duplicate set for seamless loop */}
                            {[
                                {
                                    icon: BookOpen,
                                    title: tLanding("useCases.study.title"),
                                    description: tLanding("useCases.study.description"),
                                    image: "/images/use-cases/study.jpg",
                                },
                                {
                                    icon: Users,
                                    title: tLanding("useCases.clients.title"),
                                    description: tLanding("useCases.clients.description"),
                                    image: "/images/use-cases/clients.jpg",
                                },
                                {
                                    icon: Barbell,
                                    title: tLanding("useCases.fitness.title"),
                                    description: tLanding("useCases.fitness.description"),
                                    image: "/images/use-cases/fitness.jpg",
                                },
                                {
                                    icon: Heart,
                                    title: tLanding("useCases.social.title"),
                                    description: tLanding("useCases.social.description"),
                                    image: "/images/use-cases/social.jpg",
                                },
                                {
                                    icon: Globe,
                                    title: tLanding("useCases.remote.title"),
                                    description: tLanding("useCases.remote.description"),
                                    image: "/images/use-cases/remote.jpg",
                                },
                                {
                                    icon: Users,
                                    title: tLanding("useCases.community.title"),
                                    description: tLanding("useCases.community.description"),
                                    image: "/images/use-cases/community.jpg",
                                },
                                {
                                    icon: Lightning,
                                    title: tLanding("useCases.workshops.title"),
                                    description: tLanding("useCases.workshops.description"),
                                    image: "/images/use-cases/workshops.jpg",
                                },
                            ].map((useCase, index) => (
                                <div key={`dup-${index}`} className="shrink-0 w-72 md:w-80 mx-4">
                                    <Card className="group relative overflow-hidden h-96 glass hover:border-primary/50 transition-all duration-300">
                                        <div className="absolute inset-0">
                                            <Image
                                                src={useCase.image}
                                                alt={useCase.title}
                                                fill
                                                sizes="(max-width: 768px) 288px, 320px"
                                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                                loading="lazy"
                                                quality={75}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                                        </div>
                                        <CardContent className="absolute bottom-0 left-0 right-0 p-6 text-white">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-10 h-10 rounded-lg bg-primary/20 backdrop-blur-sm flex items-center justify-center">
                                                    <useCase.icon className="w-5 h-5" weight="fill" />
                                                </div>
                                                <h3 className="text-xl font-bold">{useCase.title}</h3>
                                            </div>
                                            <p className="text-sm text-white/80 line-clamp-2">{useCase.description}</p>
                                        </CardContent>
                                    </Card>
                                </div>
                            ))}
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works-section" className="py-20 px-4 bg-muted/30">
                <div className="container mx-auto max-w-4xl">
                    <FadeIn>
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-5xl font-bold mb-4">{tLanding("howTitle")}</h2>
                            <p className="text-muted-foreground text-lg">{tLanding("howSubtitle")}</p>
                        </div>
                    </FadeIn>

                    <div className="space-y-12">
                        {[
                            {
                                number: 1,
                                title: tLanding("steps.create.title"),
                                description: tLanding("steps.create.description"),
                                icon: Calendar,
                            },
                            {
                                number: 2,
                                title: tLanding("steps.share.title"),
                                description: tLanding("steps.share.description"),
                                icon: ShareNetwork,
                            },
                            {
                                number: 3,
                                title: tLanding("steps.select.title"),
                                description: tLanding("steps.select.description"),
                                icon: Clock,
                            },
                            {
                                number: 4,
                                title: tLanding("steps.pick.title"),
                                description: tLanding("steps.pick.description"),
                                icon: CalendarCheck,
                            },
                        ].map((step, idx) => (
                            <FadeIn key={step.number} delay={idx * 150}>
                                <div className="relative flex gap-6 items-start step-connector">
                                    {/* Numbered circle with icon */}
                                    <div className="relative shrink-0 z-10">
                                        <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shadow-lg">
                                            {step.number}
                                        </div>
                                        <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                            <step.icon className="w-4 h-4 text-primary" weight="fill" />
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 pt-2">
                                        <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                                        <p className="text-muted-foreground text-lg leading-relaxed">
                                            {step.description}
                                        </p>
                                    </div>
                                </div>
                            </FadeIn>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-4 bg-background">
                <div className="container mx-auto max-w-5xl">
                    <FadeIn>
                        <Card className="relative overflow-hidden border-0 shadow-2xl">
                            {/* Gradient background */}
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent" />
                            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
                            <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />

                            <CardContent className="relative py-16 px-8 text-center space-y-6">
                                <h2 className="text-3xl md:text-5xl font-bold text-balance">
                                    {tLanding("ctaTitle")}
                                </h2>
                                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                                    {tLanding("ctaDescription")}
                                </p>
                                <Link href="/create">
                                    <Button size="lg" className="h-14 px-10 text-lg font-semibold group">
                                        <Calendar className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                                        {tLanding("ctaButton")}
                                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    </FadeIn>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-border/50 bg-muted/30 py-12 px-4">
                <div className="container mx-auto max-w-7xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
                        {/* Logo and description */}
                        <div className="space-y-4">
                            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                                    <span className="text-primary-foreground font-bold text-lg">P</span>
                                </div>
                                <span className="font-bold text-xl">{tCommon("appName")}</span>
                            </Link>
                            <p className="text-sm text-muted-foreground max-w-xs">
                                {tLanding("footerDescription")}
                            </p>
                        </div>

                        {/* Product */}
                        <div>
                            <h3 className="font-semibold mb-4">Product</h3>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li>
                                    <a href="#features-section" className="hover:text-primary transition-colors">
                                        Features
                                    </a>
                                </li>
                                <li>
                                    <a href="#use-cases-section" className="hover:text-primary transition-colors">
                                        Use Cases
                                    </a>
                                </li>
                                <li>
                                    <a href="#how-it-works-section" className="hover:text-primary transition-colors">
                                        How it Works
                                    </a>
                                </li>
                                <li>
                                    <Link href="/create" className="hover:text-primary transition-colors">
                                        Create Event
                                    </Link>
                                </li>
                            </ul>
                        </div>

                        {/* Company */}
                        <div>
                            <h3 className="font-semibold mb-4">Company</h3>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li>
                                    <Link href="/privacy" className="hover:text-primary transition-colors">
                                        {tCommon("privacy")}
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/terms" className="hover:text-primary transition-colors">
                                        {tCommon("terms")}
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/imprint" className="hover:text-primary transition-colors">
                                        {tCommon("imprint")}
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/contact" className="hover:text-primary transition-colors">
                                        {tCommon("contact")}
                                    </Link>
                                </li>
                            </ul>
                        </div>

                        {/* Resources */}
                        <div>
                            <h3 className="font-semibold mb-4">Resources</h3>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                {isLoggedIn ? (
                                    <>
                                        <li>
                                            <Link href="/dashboard" className="hover:text-primary transition-colors">
                                                {tCommon("myDashboard")}
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href="/settings" className="hover:text-primary transition-colors">
                                                Settings
                                            </Link>
                                        </li>
                                    </>
                                ) : (
                                    <li>
                                        <Link href="/login" className="hover:text-primary transition-colors">
                                            {tCommon("signInRegister")}
                                        </Link>
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>

                    {/* Bottom bar */}
                    <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
                        <p>© {new Date().getFullYear()} {tCommon("appName")}. All rights reserved.</p>
                        <p className="text-center">{tLanding("footer")}</p>
                    </div>
                </div>
            </footer>
        </main>
    )
}

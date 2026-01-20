"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Clock, Users, Share2, Sparkles, Zap, Menu, X, Dumbbell, Globe, Heart, BookOpen } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { logout, getAccessToken, getStoredUsername, ensureAuth } from "@/lib/api"
import { useTranslations } from "@/components/language-provider"
import { useInView } from "@/hooks/use-in-view"
import { cn } from "@/lib/utils"
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel"
import Autoplay from "embla-carousel-autoplay"

const FadeIn = ({ children, className, delay = 0 }: { children: React.ReactNode, className?: string, delay?: number }) => {
    const { ref, isInView } = useInView({ threshold: 0.1 })
    return (
        <div
            ref={ref}
            className={cn(
                "transition-all duration-700 ease-out transform opacity-0 translate-y-8",
                isInView && "opacity-100 translate-y-0",
                className
            )}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    )
}

export default function LandingPage() {
    const router = useRouter()
    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [username, setUsername] = useState("")
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const { t } = useTranslations()

    // Animation mount check
    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        setMounted(true)
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
        <div className="min-h-screen bg-gradient-to-br from-background via-purple-900/10 to-primary/20 dark:from-background dark:via-purple-900/20 dark:to-primary/10">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b border-primary/5 supports-[backdrop-filter]:bg-background/20">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between relative">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center overflow-hidden">
                            <Image
                                src="/app-icon.png"
                                alt={t("common.appName")}
                                width={32}
                                height={32}
                                className="w-8 h-8"
                                priority
                            />
                        </div>
                        <span className="font-bold text-xl">{t("common.appName")}</span>
                    </div>

                    {/* Desktop actions */}
                    <div className="hidden sm:flex items-center gap-3">
                        {isLoggedIn && (
                            <span className="text-sm text-muted-foreground">
                                {t("common.signedInAs", { name: username || t("common.guest") })}
                            </span>
                        )}

                        {isLoggedIn && (
                            <Link href="/dashboard">
                                <Button variant="outline" size="sm" className="font-semibold">
                                    {t("common.myDashboard")}
                                </Button>
                            </Link>
                        )}

                        <Link href="/create">
                            <Button size="sm" className="font-semibold">
                                {t("common.createEvent")}
                            </Button>
                        </Link>

                        {isLoggedIn ? (
                            <Button variant="ghost" size="sm" className="font-semibold" onClick={handleSignOut}>
                                {t("common.signOut")}
                            </Button>
                        ) : (
                            <Link href="/login">
                                <Button variant="ghost" size="sm" className="font-semibold">
                                    {t("common.signInRegister")}
                                </Button>
                            </Link>
                        )}

                        <ThemeToggle />
                    </div>

                    {/* Mobile toggle */}
                    <div className="sm:hidden flex items-center gap-2">
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
                        <div className="absolute top-16 inset-x-0 px-4 sm:hidden">
                            <div className="rounded-xl border bg-background/95 backdrop-blur-lg shadow-lg p-4 space-y-3">
                                {isLoggedIn && (
                                    <p className="text-sm text-muted-foreground">
                                        {t("common.signedInAs", { name: username || t("common.guest") })}
                                    </p>
                                )}

                                {isLoggedIn && (
                                    <Link href="/dashboard" onClick={() => setIsMenuOpen(false)}>
                                        <Button variant="outline" className="w-full justify-center">
                                            {t("common.myDashboard")}
                                        </Button>
                                    </Link>
                                )}

                                <Link href="/create" onClick={() => setIsMenuOpen(false)}>
                                    <Button className="w-full justify-center">
                                        {t("common.createEvent")}
                                    </Button>
                                </Link>

                                {isLoggedIn ? (
                                    <Button variant="ghost" className="w-full justify-center" onClick={handleSignOut}>
                                        {t("common.signOut")}
                                    </Button>
                                ) : (
                                    <Link href="/login" onClick={() => setIsMenuOpen(false)}>
                                        <Button variant="ghost" className="w-full justify-center">
                                            {t("common.signInRegister")}
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Hero Section */}
            <section className="pt-32 pb-16 px-4">
                <div className="container mx-auto max-w-6xl text-center space-y-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-sm font-medium">{t("landing.badge")}</span>
                    </div>

                    <div className={`transition-all duration-1000 ease-out transform ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-balance">
                            {t("landing.title")}
                            <br />
                            <span className="text-primary">{t("landing.highlight")}</span>
                        </h1>
                    </div>

                    <p className={`text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-balance transition-all duration-1000 delay-200 ease-out transform ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
                        {t("landing.description")}
                    </p>

                    <div className={`flex flex-col sm:flex-row gap-4 justify-center items-center pt-4 transition-all duration-1000 delay-300 ease-out transform ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
                        <Link href="/create">
                            <Button size="lg" className="h-14 px-8 text-lg font-semibold">
                                <Calendar className="w-5 h-5 mr-2" />
                                {t("landing.primaryCta")}
                            </Button>
                        </Link>
                        <Button variant="outline" size="lg" className="h-14 px-8 text-lg font-semibold bg-transparent" asChild>
                            <a href="#features">{t("landing.secondaryCta")}</a>
                        </Button>
                    </div>

                    <p className="text-sm text-muted-foreground">{t("landing.heroNote")}</p>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-16 px-4">
                <div className="container mx-auto max-w-6xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-5xl font-bold mb-4">{t("landing.whyTitle")}</h2>
                        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t("landing.whySubtitle")}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Card className="border-0 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-all duration-300 shadow-xl ring-1 ring-white/10 hover:ring-primary/50">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <Zap className="w-6 h-6 text-primary" />
                                </div>
                                <CardTitle className="text-xl">{t("landing.features.lightning.title")}</CardTitle>
                                <CardDescription className="text-base">{t("landing.features.lightning.description")}</CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="border-0 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-all duration-300 shadow-xl ring-1 ring-white/10 hover:ring-primary/50">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <Users className="w-6 h-6 text-primary" />
                                </div>
                                <CardTitle className="text-xl">{t("landing.features.heatmap.title")}</CardTitle>
                                <CardDescription className="text-base">{t("landing.features.heatmap.description")}</CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="border-0 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-all duration-300 shadow-xl ring-1 ring-white/10 hover:ring-primary/50">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <Share2 className="w-6 h-6 text-primary" />
                                </div>
                                <CardTitle className="text-xl">{t("landing.features.sharing.title")}</CardTitle>
                                <CardDescription className="text-base">{t("landing.features.sharing.description")}</CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="border-0 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-all duration-300 shadow-xl ring-1 ring-white/10 hover:ring-primary/50">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <Calendar className="w-6 h-6 text-primary" />
                                </div>
                                <CardTitle className="text-xl">{t("landing.features.smartDates.title")}</CardTitle>
                                <CardDescription className="text-base">{t("landing.features.smartDates.description")}</CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="border-0 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-all duration-300 shadow-xl ring-1 ring-white/10 hover:ring-primary/50">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <Clock className="w-6 h-6 text-primary" />
                                </div>
                                <CardTitle className="text-xl">{t("landing.features.timezones.title")}</CardTitle>
                                <CardDescription className="text-base">{t("landing.features.timezones.description")}</CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="border-0 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-all duration-300 shadow-xl ring-1 ring-white/10 hover:ring-primary/50">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <Sparkles className="w-6 h-6 text-primary" />
                                </div>
                                <CardTitle className="text-xl">{t("landing.features.design.title")}</CardTitle>
                                <CardDescription className="text-base">{t("landing.features.design.description")}</CardDescription>
                            </CardHeader>
                        </Card>
                    </div>
                </div>
            </section>

            {/* Use Cases Section */}
            <section className="py-16 bg-muted/50 dark:bg-muted/10 overflow-hidden">
                <div className="container mx-auto max-w-6xl px-4 mb-8">
                    <FadeIn>
                        <h2 className="text-3xl md:text-5xl font-bold text-left">{t("landing.useCases.title")}</h2>
                    </FadeIn>
                </div>

                {/* Marquee Container */}
                <div className="relative w-full">
                    {/* Gradient overlays for smooth fade effect */}
                    <div className="absolute left-0 top-0 bottom-0 w-24 md:w-40 bg-gradient-to-r from-muted/50 dark:from-muted/10 to-transparent z-10 pointer-events-none" />
                    <div className="absolute right-0 top-0 bottom-0 w-24 md:w-40 bg-gradient-to-l from-muted/50 dark:from-muted/10 to-transparent z-10 pointer-events-none" />
                    
                    <FadeIn delay={100}>
                        <div className="flex animate-marquee hover:[animation-play-state:paused]">
                            {/* First set of cards */}
                            {[
                                { icon: Users, title: t("landing.useCases.team.title"), description: t("landing.useCases.team.description"), color: "2563eb", image: "Team" },
                                { icon: Sparkles, title: t("landing.useCases.social.title"), description: t("landing.useCases.social.description"), color: "ec4899", image: "Social" },
                                { icon: Zap, title: t("landing.useCases.study.title"), description: t("landing.useCases.study.description"), color: "f59e0b", image: "Study" },
                                { icon: Calendar, title: t("landing.useCases.clients.title"), description: t("landing.useCases.clients.description"), color: "a855f7", image: "Clients" },
                                { icon: Dumbbell, title: t("landing.useCases.fitness.title"), description: t("landing.useCases.fitness.description"), color: "10b981", image: "Fitness" },
                                { icon: Globe, title: t("landing.useCases.remote.title"), description: t("landing.useCases.remote.description"), color: "06b6d4", image: "Remote" },
                                { icon: Heart, title: t("landing.useCases.community.title"), description: t("landing.useCases.community.description"), color: "f43f5e", image: "Community" },
                                { icon: BookOpen, title: t("landing.useCases.workshops.title"), description: t("landing.useCases.workshops.description"), color: "8b5cf6", image: "Workshops" },
                            ].map((useCase, index) => (
                                <div key={index} className="flex-shrink-0 w-[280px] md:w-[320px] mx-3">
                                    <div className="group relative aspect-video overflow-hidden rounded-xl bg-muted">
                                        <Image
                                            src={`https://placehold.co/600x400/${useCase.color}/FFF?text=${useCase.image}`}
                                            alt={useCase.title}
                                            fill
                                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />
                                        <div className="absolute bottom-4 left-4 right-4">
                                            <div className="flex items-center gap-2 mb-2 text-white/90">
                                                <useCase.icon className="w-5 h-5" />
                                                <h3 className="text-lg font-bold">{useCase.title}</h3>
                                            </div>
                                            <p className="text-sm text-white/70 line-clamp-2">
                                                {useCase.description}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {/* Duplicate set for seamless loop */}
                            {[
                                { icon: Users, title: t("landing.useCases.team.title"), description: t("landing.useCases.team.description"), color: "2563eb", image: "Team" },
                                { icon: Sparkles, title: t("landing.useCases.social.title"), description: t("landing.useCases.social.description"), color: "ec4899", image: "Social" },
                                { icon: Zap, title: t("landing.useCases.study.title"), description: t("landing.useCases.study.description"), color: "f59e0b", image: "Study" },
                                { icon: Calendar, title: t("landing.useCases.clients.title"), description: t("landing.useCases.clients.description"), color: "a855f7", image: "Clients" },
                                { icon: Dumbbell, title: t("landing.useCases.fitness.title"), description: t("landing.useCases.fitness.description"), color: "10b981", image: "Fitness" },
                                { icon: Globe, title: t("landing.useCases.remote.title"), description: t("landing.useCases.remote.description"), color: "06b6d4", image: "Remote" },
                                { icon: Heart, title: t("landing.useCases.community.title"), description: t("landing.useCases.community.description"), color: "f43f5e", image: "Community" },
                                { icon: BookOpen, title: t("landing.useCases.workshops.title"), description: t("landing.useCases.workshops.description"), color: "8b5cf6", image: "Workshops" },
                            ].map((useCase, index) => (
                                <div key={`dup-${index}`} className="flex-shrink-0 w-[280px] md:w-[320px] mx-3">
                                    <div className="group relative aspect-video overflow-hidden rounded-xl bg-muted">
                                        <Image
                                            src={`https://placehold.co/600x400/${useCase.color}/FFF?text=${useCase.image}`}
                                            alt={useCase.title}
                                            fill
                                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />
                                        <div className="absolute bottom-4 left-4 right-4">
                                            <div className="flex items-center gap-2 mb-2 text-white/90">
                                                <useCase.icon className="w-5 h-5" />
                                                <h3 className="text-lg font-bold">{useCase.title}</h3>
                                            </div>
                                            <p className="text-sm text-white/70 line-clamp-2">
                                                {useCase.description}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-16 px-4 bg-muted/30">
                <div className="container mx-auto max-w-4xl">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-5xl font-bold mb-4">{t("landing.howTitle")}</h2>
                        <p className="text-muted-foreground text-lg">{t("landing.howSubtitle")}</p>
                    </div>

                    <div className="space-y-8">
                        <div className="flex gap-6 items-start">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                                1
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2">{t("landing.steps.create.title")}</h3>
                                <p className="text-muted-foreground">{t("landing.steps.create.description")}</p>
                            </div>
                        </div>

                        <div className="flex gap-6 items-start">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                                2
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2">{t("landing.steps.share.title")}</h3>
                                <p className="text-muted-foreground">{t("landing.steps.share.description")}</p>
                            </div>
                        </div>

                        <div className="flex gap-6 items-start">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                                3
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2">{t("landing.steps.select.title")}</h3>
                                <p className="text-muted-foreground">{t("landing.steps.select.description")}</p>
                            </div>
                        </div>

                        <div className="flex gap-6 items-start">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                                4
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2">{t("landing.steps.pick.title")}</h3>
                                <p className="text-muted-foreground">{t("landing.steps.pick.description")}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-4">
                <div className="container mx-auto max-w-4xl text-center">
                    <Card className="border-0 shadow-2xl bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-xl ring-1 ring-primary/20">
                        <CardContent className="pt-12 pb-12 space-y-6">
                            <h2 className="text-3xl md:text-5xl font-bold text-balance">{t("landing.ctaTitle")}</h2>
                            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t("landing.ctaDescription")}</p>
                            <Link href="/create">
                                <Button size="lg" className="h-14 px-10 text-lg font-semibold">
                                    <Calendar className="w-5 h-5 mr-2" />
                                    {t("landing.ctaButton")}
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </section>

        </div>
    )
}
"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Clock, Users, ShareNetwork, Sparkle, Lightning, X, Barbell, Globe, Heart, BookOpen, List as Menu } from "phosphor-react"
import { logout, getStoredUsername, ensureAuth } from "@/lib/api"
import { useTranslations } from "@/components/language-provider"
import { useInView } from "@/hooks/use-in-view"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import Aurora from "@/components/Aurora.jsx"

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
    const { t } = useTranslations()

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
            <div className="flex flex-col gap-6 sm:gap-0">
                {/* Header */}
                <header
                    className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                        scrolled
                            ? "bg-background/60 backdrop-blur-xl border-b border-primary/5 supports-backdrop-filter:bg-background/20"
                            : "bg-transparent border-b border-transparent"
                    }`}
                >
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
                                        <Button className="w-full justify-center">{t("common.createEvent")}</Button>
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
                <section className="min-h-screen-safe relative sm:sticky sm:top-0 z-10 bg-background rounded-t-3xl shadow-xl border border-border transition-all duration-300 overflow-hidden">
                    {/* Aurora background - covers the entire card */}
                    <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none z-0">
                        <div className="w-full h-full max-w-none max-h-none">
                            <Aurora colorStops={["#5227FF", "#ff40ff", "#5227FF"]} amplitude={1} blend={0.5} />
                        </div>
                    </div>

                    {/* Hero content */}
                    <div className="flex flex-col justify-center items-center min-h-screen-safe pt-24 pb-16 px-4 relative z-10">
                        <div className="w-full max-w-6xl text-center space-y-8 flex flex-col justify-center items-center flex-1">
                            <div
                                className={`transition-all duration-1000 ease-out transform ${
                                    mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                                }`}
                            >
                                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-balance">
                                    {t("landing.title")}
                                    <br />
                                    <span className="text-primary">{t("landing.highlight")}</span>
                                </h1>
                            </div>

                            <p
                                className={`text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-balance transition-all duration-1000 delay-200 ease-out transform ${
                                    mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                                }`}
                            >
                                {t("landing.description")}
                            </p>

                            <div
                                className={`flex flex-col sm:flex-row gap-4 justify-center items-center pt-4 transition-all duration-1000 delay-300 ease-out transform ${
                                    mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                                }`}
                            >
                                <Link href="/create">
                                    <Button size="lg" className="h-14 px-8 text-lg font-semibold">
                                        <Calendar className="w-5 h-5 mr-2" />
                                        {t("landing.primaryCta")}
                                    </Button>
                                </Link>
                                <Button variant="outline" size="lg" className="h-14 px-8 text-lg font-semibold bg-transparent" asChild>
                                    <a href="#features-section">{t("landing.secondaryCta")}</a>
                                </Button>
                            </div>

                            <p className="text-sm text-muted-foreground">{t("landing.heroNote")}</p>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section
                    id="features-section"
                    className="min-h-screen-safe relative sm:sticky sm:top-4 z-20 bg-background rounded-t-3xl shadow-xl border border-border transition-all duration-300 mt-0 sm:-mt-12"
                >
                    <div className="py-16 px-4">
                        <div className="container mx-auto max-w-6xl">
                            <div className="text-left mb-12">
                                <h2 className="text-3xl md:text-5xl font-bold mb-4">{t("landing.whyTitle")}</h2>
                                <p className="text-muted-foreground text-lg max-w-2xl">{t("landing.whySubtitle")}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <Card className="border-0 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-all duration-300 shadow-xl ring-1 ring-white/10 hover:ring-primary/50">
                                    <CardHeader>
                                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                            <Lightning className="w-6 h-6 text-primary" />
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
                                            <ShareNetwork className="w-6 h-6 text-primary" />
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
                                            <Sparkle className="w-6 h-6 text-primary" />
                                        </div>
                                        <CardTitle className="text-xl">{t("landing.features.design.title")}</CardTitle>
                                        <CardDescription className="text-base">{t("landing.features.design.description")}</CardDescription>
                                    </CardHeader>
                                </Card>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Use Cases Section */}
                <section className="min-h-screen-safe relative sm:sticky sm:top-8 z-30 bg-background rounded-t-3xl shadow-xl border border-border transition-all duration-300 mt-0 sm:-mt-12">
                    <div className="py-16 bg-muted/50 dark:bg-muted/10 overflow-hidden">
                        <div className="container mx-auto max-w-6xl px-4 mb-8">
                            <FadeIn>
                                <h2 className="text-3xl md:text-5xl font-bold text-left">
                                    {t("landing.useCases.title")}
                                </h2>
                            </FadeIn>
                        </div>

                        {/* Marquee Container */}
                        <div className="relative w-full">
                            {/* Gradient overlays */}
                            <div className="absolute left-0 top-0 bottom-0 w-24 md:w-40 bg-[linear-gradient(to_right,hsl(var(--muted)/0.5),transparent)] dark:bg-[linear-gradient(to_right,hsl(var(--muted)/0.1),transparent)] z-10 pointer-events-none" />
                            <div className="absolute right-0 top-0 bottom-0 w-24 md:w-40 bg-[linear-gradient(to_left,hsl(var(--muted)/0.5),transparent)] dark:bg-[linear-gradient(to_left,hsl(var(--muted)/0.1),transparent)] z-10 pointer-events-none" />

                            <FadeIn delay={100}>
                                <div className="flex animate-marquee">
                                    {/* First set of cards */}
                                    {[
                                        {
                                            icon: Users,
                                            title: t("landing.useCases.team.title"),
                                            description: t("landing.useCases.team.description"),
                                            image: "/images/use-cases/team.jpg",
                                        },
                                        {
                                            icon: Sparkle,
                                            title: t("landing.useCases.social.title"),
                                            description: t("landing.useCases.social.description"),
                                            image: "/images/use-cases/social.jpg",
                                        },
                                        {
                                            icon: Lightning,
                                            title: t("landing.useCases.study.title"),
                                            description: t("landing.useCases.study.description"),
                                            image: "/images/use-cases/study.jpg",
                                        },
                                        {
                                            icon: Calendar,
                                            title: t("landing.useCases.clients.title"),
                                            description: t("landing.useCases.clients.description"),
                                            image: "/images/use-cases/clients.jpg",
                                        },
                                        {
                                            icon: Barbell,
                                            title: t("landing.useCases.fitness.title"),
                                            description: t("landing.useCases.fitness.description"),
                                            image: "/images/use-cases/fitness.jpg",
                                        },
                                        {
                                            icon: Globe,
                                            title: t("landing.useCases.remote.title"),
                                            description: t("landing.useCases.remote.description"),
                                            image: "/images/use-cases/remote.jpg",
                                        },
                                        {
                                            icon: Heart,
                                            title: t("landing.useCases.community.title"),
                                            description: t("landing.useCases.community.description"),
                                            image: "/images/use-cases/community.jpg",
                                        },
                                        {
                                            icon: BookOpen,
                                            title: t("landing.useCases.workshops.title"),
                                            description: t("landing.useCases.workshops.description"),
                                            image: "/images/use-cases/workshops.jpg",
                                        },
                                    ].map((useCase, index) => (
                                        <div
                                            key={index}
                                            className="shrink-0 w-60 md:w-80 mx-4"
                                        >
                                            <div className="group relative aspect-4/5 overflow-hidden rounded-2xl bg-muted min-h-80 md:min-h-105 flex flex-col justify-end shadow-lg border border-border transition-all duration-300">
                                                <Image
                                                    src={useCase.image}
                                                    alt={useCase.title}
                                                    fill
                                                    sizes="(max-width: 768px) 240px, 320px"
                                                    className="absolute inset-0 object-cover w-full h-full transition-transform duration-500 group-hover:scale-105 will-change-transform"
                                                    loading="lazy"
                                                    quality={75}
                                                />
                                                <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.8),rgba(0,0,0,0.2),transparent)] opacity-80" />
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
                                        {
                                            icon: Users,
                                            title: t("landing.useCases.team.title"),
                                            description: t("landing.useCases.team.description"),
                                            image: "/images/use-cases/team.jpg",
                                        },
                                        {
                                            icon: Sparkle,
                                            title: t("landing.useCases.social.title"),
                                            description: t("landing.useCases.social.description"),
                                            image: "/images/use-cases/social.jpg",
                                        },
                                        {
                                            icon: Lightning,
                                            title: t("landing.useCases.study.title"),
                                            description: t("landing.useCases.study.description"),
                                            image: "/images/use-cases/study.jpg",
                                        },
                                        {
                                            icon: Calendar,
                                            title: t("landing.useCases.clients.title"),
                                            description: t("landing.useCases.clients.description"),
                                            image: "/images/use-cases/clients.jpg",
                                        },
                                        {
                                            icon: Barbell,
                                            title: t("landing.useCases.fitness.title"),
                                            description: t("landing.useCases.fitness.description"),
                                            image: "/images/use-cases/fitness.jpg",
                                        },
                                        {
                                            icon: Globe,
                                            title: t("landing.useCases.remote.title"),
                                            description: t("landing.useCases.remote.description"),
                                            image: "/images/use-cases/remote.jpg",
                                        },
                                        {
                                            icon: Heart,
                                            title: t("landing.useCases.community.title"),
                                            description: t("landing.useCases.community.description"),
                                            image: "/images/use-cases/community.jpg",
                                        },
                                        {
                                            icon: BookOpen,
                                            title: t("landing.useCases.workshops.title"),
                                            description: t("landing.useCases.workshops.description"),
                                            image: "/images/use-cases/workshops.jpg",
                                        },
                                    ].map((useCase, index) => (
                                        <div
                                            key={`dup-${index}`}
                                            className="shrink-0 w-60 md:w-80 mx-4"
                                        >
                                            <div className="group relative aspect-4/5 overflow-hidden rounded-2xl bg-muted min-h-80 md:min-h-105 flex flex-col justify-end shadow-lg border border-border transition-all duration-300">
                                                <Image
                                                    src={useCase.image}
                                                    alt={useCase.title}
                                                    fill
                                                    sizes="(max-width: 768px) 240px, 320px"
                                                    className="absolute inset-0 object-cover w-full h-full transition-transform duration-500 group-hover:scale-105 will-change-transform"
                                                    loading="lazy"
                                                    quality={75}
                                                />
                                                <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.8),rgba(0,0,0,0.2),transparent)] opacity-80" />
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
                    </div>
                </section>

                {/* How It Works Section */}
                <section className="min-h-screen-safe relative sm:sticky sm:top-12 z-40 bg-background rounded-t-3xl shadow-xl border border-border transition-all duration-300 mt-0 sm:-mt-12">
                    <div className="py-16 px-4 flex flex-col justify-center items-center min-h-screen-safe">
                        <div className="container mx-auto max-w-4xl">
                            <div className="text-left mb-12">
                                <h2 className="text-3xl md:text-5xl font-bold mb-4">{t("landing.howTitle")}</h2>
                                <p className="text-muted-foreground text-lg">{t("landing.howSubtitle")}</p>
                            </div>
                            <div className="space-y-8">
                                {[1, 2, 3, 4].map((step, idx) => (
                                    <FadeIn key={step} delay={idx * 200}>
                                        <div className="flex gap-6 items-start">
                                            <div className="shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                                                {step}
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-semibold mb-2">
                                                    {t(`landing.steps.${["create", "share", "select", "pick"][idx]}.title`)}
                                                </h3>
                                                <p className="text-muted-foreground">
                                                    {t(`landing.steps.${["create", "share", "select", "pick"][idx]}.description`)}
                                                </p>
                                            </div>
                                        </div>
                                    </FadeIn>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="min-h-screen-safe relative sm:sticky sm:top-16 z-50 bg-background rounded-t-3xl shadow-xl border border-border transition-all duration-300 flex items-center justify-center mt-0 sm:-mt-12">
                    <div className="container mx-auto max-w-4xl text-center flex flex-col justify-center items-center min-h-screen-safe">
                        <Card className="border-0 shadow-2xl bg-linear-to-br from-primary/10 to-primary/5 backdrop-blur-xl ring-1 ring-primary/20">
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
        </main>
    )
}

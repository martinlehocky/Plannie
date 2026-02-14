"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Link } from "@/src/i18n/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { logout, getStoredUsername, ensureAuth } from "@/lib/api"
import { useInView } from "@/hooks/use-in-view"
import { cn } from "@/lib/utils"
import {
    Calendar,
    Clock,
    Users,
    ShareNetwork,
    Sparkle,
    Lightning,
    X,
    Barbell,
    Globe,
    Heart,
    BookOpen,
    List as Menu,
    Moon,
    Sun,
} from "phosphor-react"

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
    const [scrolled, setScrolled] = useState(false)
    const [isDark, setIsDark] = useState(true)

    const tCommon = useTranslations("common")
    const tLanding = useTranslations("landing")

    useEffect(() => {
        // Default to dark mode
        document.documentElement.classList.add("dark")
        setIsDark(true)

        const handleScroll = () => setScrolled(window.scrollY > 20)
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

    const toggleTheme = () => {
        const nextDark = !isDark
        setIsDark(nextDark)
        document.documentElement.classList.toggle("dark", nextDark)
    }

    const handleSignOut = async () => {
        await logout()
        setIsLoggedIn(false)
        setUsername("")
        setIsMenuOpen(false)
    }

    const useCases = useMemo(
        () => [
            {
                icon: Users,
                title: tLanding("useCases.team.title"),
                description: tLanding("useCases.team.description"),
                image: "/images/use-cases/team.jpg",
            },
            {
                icon: Sparkle,
                title: tLanding("useCases.social.title"),
                description: tLanding("useCases.social.description"),
                image: "/images/use-cases/social.jpg",
            },
            {
                icon: Lightning,
                title: tLanding("useCases.study.title"),
                description: tLanding("useCases.study.description"),
                image: "/images/use-cases/study.jpg",
            },
            {
                icon: Calendar,
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
                icon: Globe,
                title: tLanding("useCases.remote.title"),
                description: tLanding("useCases.remote.description"),
                image: "/images/use-cases/remote.jpg",
            },
            {
                icon: Heart,
                title: tLanding("useCases.community.title"),
                description: tLanding("useCases.community.description"),
                image: "/images/use-cases/community.jpg",
            },
            {
                icon: BookOpen,
                title: tLanding("useCases.workshops.title"),
                description: tLanding("useCases.workshops.description"),
                image: "/images/use-cases/workshops.jpg",
            },
        ],
        [tLanding]
    )

    return (
        <main className="relative w-full min-h-screen bg-background text-foreground">
            {/* Top nav */}
            <header
                className={cn(
                    "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
                    "bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-b",
                    scrolled ? "border-gray-200 dark:border-slate-800 shadow-sm" : "border-transparent"
                )}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between relative">
                    <div className="flex items-center gap-2 cursor-pointer">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center overflow-hidden">
                            <Image
                                src="/app-icon.png"
                                alt={tCommon("appName")}
                                width={32}
                                height={32}
                                className="w-8 h-8"
                                priority
                            />
                        </div>
                        <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-white">
              {tCommon("appName")}
            </span>
                    </div>

                    <div className="hidden md:flex items-center space-x-3">
                        <button
                            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-slate-800 transition"
                            onClick={toggleTheme}
                            aria-label={tCommon("toggleTheme")}
                        >
                            {isDark ? <Sun size={20} /> : <Moon size={20} />}
                        </button>

                        {isLoggedIn && (
                            <Link href="/dashboard">
                                <Button variant="outline" size="sm" className="font-semibold">
                                    {tCommon("myDashboard")}
                                </Button>
                            </Link>
                        )}

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

                    <Button
                        variant="outline"
                        size="icon"
                        className="rounded-lg md:hidden"
                        onClick={() => setIsMenuOpen((prev) => !prev)}
                        aria-label={tCommon("toggleMenu")}
                    >
                        {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </Button>

                    {isMenuOpen && (
                        <div className="absolute top-16 inset-x-0 px-4 md:hidden z-50">
                            <div className="rounded-2xl border bg-white/98 dark:bg-slate-950/95 backdrop-blur-xl shadow-2xl p-5 space-y-4">
                                {isLoggedIn && (
                                    <p className="text-sm text-muted-foreground">
                                        {tCommon("signedInAs", { name: username || tCommon("guest") })}
                                    </p>
                                )}
                                <div className="space-y-2 text-sm font-medium text-gray-900 dark:text-gray-50">
                                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Navigation</div>
                                    <a className="block rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-800" href="#features" onClick={() => setIsMenuOpen(false)}>
                                        {tLanding("nav.features")}
                                    </a>
                                    <a className="block rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-800" href="#use-cases" onClick={() => setIsMenuOpen(false)}>
                                        {tLanding("nav.useCases")}
                                    </a>
                                    <a className="block rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-800" href="#how-it-works" onClick={() => setIsMenuOpen(false)}>
                                        {tLanding("nav.howItWorks")}
                                    </a>
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <Link href="/create">
                                        <Button size="sm" className="w-full">
                                            {tCommon("createEvent")}
                                        </Button>
                                    </Link>
                                    {isLoggedIn ? (
                                        <Button variant="ghost" size="sm" className="w-full" onClick={handleSignOut}>
                                            {tCommon("signOut")}
                                        </Button>
                                    ) : (
                                        <Link href="/login">
                                            <Button variant="ghost" size="sm" className="w-full">
                                                {tCommon("signInRegister")}
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {isMenuOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] md:hidden"
                    onClick={() => setIsMenuOpen(false)}
                />
            )}

            {/* Hero */}
            <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden bg-background">
                <div className="absolute top-0 left-1/2 w-full -translate-x-1/2 h-full z-0 pointer-events-none">
                    <div className="absolute top-20 left-10 w-96 h-96 bg-purple-400/20 rounded-full blur-[110px] mix-blend-multiply dark:mix-blend-screen animate-pulse" />
                    <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-500/20 rounded-full blur-[110px] mix-blend-multiply dark:mix-blend-screen" />
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="lg:grid lg:grid-cols-2 gap-12 items-center">
                        <div className="text-center lg:text-left mb-12 lg:mb-0">
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-gray-900 dark:text-white leading-tight">
                                {tLanding("heroTitleLine1")} <br className="hidden lg:block" />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-300">
                  {tLanding("heroTitleLine2")}
                </span>
                            </h1>
                            <p className="text-lg md:text-xl text-gray-700 dark:text-gray-200 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                                {tLanding("heroSubtitle")}
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start w-full sm:w-auto">
                                <Link href="/create" className="w-full sm:w-auto">
                                    <Button
                                        size="lg"
                                        className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 text-base font-semibold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-purple-500/30 transition-all transform hover:-translate-y-1"
                                    >
                                        <Calendar className="w-5 h-5" />
                                        {tLanding("primaryCta")}
                                    </Button>
                                </Link>
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 text-base font-semibold border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2 text-gray-800 dark:text-gray-100"
                                    asChild
                                >
                                    <a href="#how-it-works">{tLanding("secondaryCta")}</a>
                                </Button>
                            </div>
                            <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">{tLanding("heroNote")}</p>
                        </div>

                        {/* Hero mockup */}
                        <div className="relative group perspective-1000">
                            <div className="relative bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/30 dark:border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden transform transition-transform duration-500 hover:rotate-y-2 hover:rotate-x-2">
                                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-white/60 dark:bg-slate-950/60">
                                    <div className="flex items-center gap-4">
                                        <div className="w-3 h-3 rounded-full bg-red-400" />
                                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                                        <div className="w-3 h-3 rounded-full bg-green-400" />
                                    </div>
                                        <div className="hidden sm:inline-flex text-sm font-medium text-gray-500 dark:text-gray-300 px-2 py-1 rounded-md bg-white/80 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700">
                                        {tLanding("heroMockupTitle")}
                                    </div>
                                </div>

                                <div className="p-6">
                                    <div className="grid grid-cols-6 gap-2 text-center mb-2">
                                        <div className="text-xs font-semibold text-gray-400"></div>
                                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-100">{tLanding("days.mon")}</div>
                                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-100">{tLanding("days.tue")}</div>
                                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-100">{tLanding("days.wed")}</div>
                                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-100">{tLanding("days.thu")}</div>
                                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-100">{tLanding("days.fri")}</div>
                                    </div>
                                    {["9am", "10am", "11am", "12pm"].map((key, rowIdx) => {
                                        const label = tLanding(`timeSlots.${key}`)
                                        return (
                                            <div key={key} className="grid grid-cols-6 gap-2 mb-2 h-10 items-center">
                                                <span className="text-xs text-gray-500 dark:text-gray-300 text-right pr-2">{label}</span>
                                                {[0, 1, 2, 3, 4].map((col) => {
                                                    const intensity = (rowIdx + col) % 4
                                                    const bg = [
                                                        "bg-gray-200 dark:bg-slate-800/60",
                                                        "bg-purple-200 dark:bg-purple-900/40",
                                                        "bg-purple-300 dark:bg-purple-800/70",
                                                        "bg-purple-500 dark:bg-primary",
                                                    ][intensity]
                                                    const glow =
                                                        intensity === 3 ? "shadow-[0_0_15px_rgba(124,58,237,0.55)] border border-purple-400/40" : ""
                                                    return <div key={col} className={cn("h-full rounded-lg heatmap-cell", bg, glow)} />
                                                })}
                                            </div>
                                        )
                                    })}
                                </div>

                                <div className="absolute bottom-6 right-6 bg-white/95 dark:bg-slate-950/90 rounded-lg shadow-lg p-3 flex items-center gap-3 border border-gray-100 dark:border-slate-700">
                                    <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                        <Sparkle className="w-4 h-4" />
                                    </div>
                                    <div className="text-xs">
                                        <p className="font-bold text-gray-800 dark:text-white">{tLanding("bestTimeFound")}</p>
                                        <p className="text-gray-600 dark:text-gray-300">{tLanding("bestTimeValue")}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="absolute -z-10 -top-10 -right-10 w-40 h-40 bg-purple-500 rounded-full blur-3xl opacity-20" />
                            <div className="absolute -z-10 -bottom-10 -left-10 w-40 h-40 bg-blue-500 rounded-full blur-3xl opacity-20" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="py-20 bg-white dark:bg-slate-950 transition-colors duration-300" id="features">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-left mb-16">
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">{tLanding("whyTitle")}</h2>
                        <p className="text-lg text-gray-700 dark:text-gray-200 max-w-2xl">{tLanding("whySubtitle")}</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            { icon: Lightning, title: tLanding("features.lightning.title"), description: tLanding("features.lightning.description") },
                            { icon: Users, title: tLanding("features.heatmap.title"), description: tLanding("features.heatmap.description") },
                            { icon: Calendar, title: tLanding("features.smartDates.title"), description: tLanding("features.smartDates.description") },
                            { icon: Clock, title: tLanding("features.timezones.title"), description: tLanding("features.timezones.description") },
                            { icon: Sparkle, title: tLanding("features.design.title"), description: tLanding("features.design.description") },
                            { icon: ShareNetwork, title: tLanding("features.sharing.title"), description: tLanding("features.sharing.description") },
                        ].map((feature) => (
                            <Card
                                key={feature.title}
                                className="p-8 rounded-2xl bg-gray-50 dark:bg-slate-900/70 hover:bg-white dark:hover:bg-slate-900 border border-transparent hover:border-gray-200 dark:hover:border-slate-700 transition-all duration-300 group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <feature.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{feature.title}</h3>
                                <p className="text-gray-700 dark:text-gray-200">{feature.description}</p>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Use Cases marquee (overlays removed) */}
            <section className="py-20 bg-gray-50 dark:bg-slate-950 overflow-hidden" id="use-cases">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-12">{tLanding("useCases.title")}</h2>

                    <div className="relative w-full">
                        <div className="flex animate-marquee" style={{ animationDelay: "-20s" }}>
                            {[...useCases, ...useCases].map((useCase, index) => (
                                <div key={`use-${index}`} className="shrink-0 w-60 md:w-80 mx-4 first:ml-0">
                                    <div className="group relative aspect-4/5 overflow-hidden rounded-2xl bg-muted min-h-80 md:min-h-105 flex flex-col justify-end shadow-lg border border-border dark:border-slate-800 transition-all duration-300">
                                        <Image
                                            src={useCase.image}
                                            alt={useCase.title}
                                            fill
                                            sizes="(max-width: 768px) 240px, 320px"
                                            className="absolute inset-0 object-cover w-full h-full transition-transform duration-500 group-hover:scale-105 will-change-transform"
                                            loading="lazy"
                                            quality={75}
                                        />
                                        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.8),rgba(0,0,0,0.25),transparent)]" />
                                        <div className="absolute bottom-4 left-4 right-4">
                                            <div className="flex items-center gap-2 mb-2 text-white">
                                                <useCase.icon className="w-5 h-5" />
                                                <span className="text-sm font-semibold">{useCase.title}</span>
                                            </div>
                                            <p className="text-white/90 text-sm">{useCase.description}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section className="py-20 bg-white dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800" id="how-it-works">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-left mb-16">
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">{tLanding("howTitle")}</h2>
                        <p className="text-gray-700 dark:text-gray-200">{tLanding("howSubtitle")}</p>
                    </div>
                    <div className="space-y-12">
                        {[1, 2, 3, 4].map((step, idx) => (
                            <div className="flex gap-6" key={step}>
                                <div className="flex-shrink-0">
                                    <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-purple-500/30">
                                        {step}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                        {tLanding(`steps.${["create", "share", "select", "pick"][idx]}.title`)}
                                    </h3>
                                    <p className="text-gray-700 dark:text-gray-200 leading-relaxed">
                                        {tLanding(`steps.${["create", "share", "select", "pick"][idx]}.description`)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 px-4">
                <div className="max-w-5xl mx-auto relative rounded-3xl overflow-hidden shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-purple-900 z-0" />
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 z-0" />
                    <div className="relative z-10 px-6 py-16 text-center">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">{tLanding("ctaTitle")}</h2>
                        <p className="text-purple-100 mb-8 max-w-2xl mx-auto text-lg">{tLanding("ctaSubtitle")}</p>
                        <div className="flex justify-center">
                            <Link href="/create">
                                <Button
                                    size="lg"
                                    className="h-14 px-8 text-base font-bold text-primary bg-white hover:bg-gray-100 shadow-xl transition-all transform hover:-translate-y-1 flex items-center gap-2"
                                >
                                    <Calendar className="w-5 h-5" />
                                    {tLanding("ctaButton")}
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    )
 }

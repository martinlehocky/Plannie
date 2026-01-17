"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Clock, Users, Share2, Sparkles, Zap, Menu, X } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { logout, getAccessToken, getStoredUsername } from "@/lib/api"
import { useTranslations } from "@/components/language-provider"

export default function LandingPage() {
    const router = useRouter()
    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [username, setUsername] = useState("")
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const { t } = useTranslations()

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
        setIsMenuOpen(false)
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b">
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

                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-balance">
                        {t("landing.title")}
                        <br />
                        <span className="text-primary">{t("landing.highlight")}</span>
                    </h1>

                    <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
                        {t("landing.description")}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
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
                        <Card className="border-2 hover:shadow-xl transition-all duration-300 hover:border-primary/50">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <Zap className="w-6 h-6 text-primary" />
                                </div>
                                <CardTitle className="text-xl">{t("landing.features.lightning.title")}</CardTitle>
                                <CardDescription className="text-base">{t("landing.features.lightning.description")}</CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="border-2 hover:shadow-xl transition-all duration-300 hover:border-primary/50">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <Users className="w-6 h-6 text-primary" />
                                </div>
                                <CardTitle className="text-xl">{t("landing.features.heatmap.title")}</CardTitle>
                                <CardDescription className="text-base">{t("landing.features.heatmap.description")}</CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="border-2 hover:shadow-xl transition-all duration-300 hover:border-primary/50">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <Share2 className="w-6 h-6 text-primary" />
                                </div>
                                <CardTitle className="text-xl">{t("landing.features.sharing.title")}</CardTitle>
                                <CardDescription className="text-base">{t("landing.features.sharing.description")}</CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="border-2 hover:shadow-xl transition-all duration-300 hover:border-primary/50">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <Calendar className="w-6 h-6 text-primary" />
                                </div>
                                <CardTitle className="text-xl">{t("landing.features.smartDates.title")}</CardTitle>
                                <CardDescription className="text-base">{t("landing.features.smartDates.description")}</CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="border-2 hover:shadow-xl transition-all duration-300 hover:border-primary/50">
                            <CardHeader>
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <Clock className="w-6 h-6 text-primary" />
                                </div>
                                <CardTitle className="text-xl">{t("landing.features.timezones.title")}</CardTitle>
                                <CardDescription className="text-base">{t("landing.features.timezones.description")}</CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="border-2 hover:shadow-xl transition-all duration-300 hover:border-primary/50">
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
                    <Card className="border-2 shadow-2xl bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
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
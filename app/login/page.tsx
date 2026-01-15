"use client"

import dynamic from "next/dynamic"
import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core"
import * as zxcvbnCommonPackage from "@zxcvbn-ts/language-common"
import * as zxcvbnEnPackage from "@zxcvbn-ts/language-en"
import { setTokens } from "@/lib/api"
import { ThemeToggle } from "@/components/theme-toggle"
import { useTranslations } from "@/components/language-provider"
import { LanguageToggle } from "@/components/language-toggle"
import { PrivacyTermsNote } from "@/components/privacy-terms-note"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ""

// Load reCAPTCHA Enterprise client-side only
const ReCAPTCHA = dynamic(() => import("react-google-recaptcha-enterprise"), { ssr: false })

// Initialize zxcvbn options once
const options = {
    translations: zxcvbnEnPackage.translations,
    graphs: zxcvbnCommonPackage.adjacencyGraphs,
    dictionary: {
        ...zxcvbnCommonPackage.dictionary,
        ...zxcvbnEnPackage.dictionary,
    },
}
zxcvbnOptions.setOptions(options)

export default function LoginPage() {
    const [isRegister, setIsRegister] = useState(false)
    const [username, setUsername] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [rememberMe, setRememberMe] = useState(true)
    const [crackTime, setCrackTime] = useState("")
    const [score, setScore] = useState(0) // 0 to 4
    const [loading, setLoading] = useState(false)
    const [tosAccepted, setTosAccepted] = useState(false)
    const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)
    const { t } = useTranslations()
    const strengthLevels = useMemo(() => t("login.strengthLevels").split("|"), [t])

    const router = useRouter()
    const { toast } = useToast()

    useEffect(() => {
        if (!password) {
            setCrackTime("")
            setScore(0)
            return
        }
        const result = zxcvbn(password)
        setScore(result.score)
        setCrackTime(result.crackTimesDisplay.offlineSlowHashing1e4PerSecond)
    }, [password])

    const passwordLooksValid = () => {
        const hasDigit = /[0-9]/.test(password)
        const hasSpec = /[!@#$%^&*()\-_=+{}[\]:;"'<>,.?/\\|]/.test(password)
        return password.length >= 8 && hasDigit && hasSpec
    }

    const emailLooksValid = () => {
        if (!isRegister) return true
        if (!email) return false
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    }

    useEffect(() => {
        if (!isRegister) {
            setRecaptchaToken(null)
            setTosAccepted(false)
        }
    }, [isRegister])

    const handleAuth = async () => {
        if (!username || !password) {
            toast({
                title: t("login.toasts.missingFieldsTitle"),
                description: t("login.toasts.missingFieldsDescription"),
                variant: "destructive",
            })
            return
        }
        if (isRegister && !passwordLooksValid()) {
            toast({
                title: t("login.toasts.passwordWeakTitle"),
                description: t("login.toasts.passwordWeakDescription"),
                variant: "destructive",
            })
            return
        }
        if (isRegister && !emailLooksValid()) {
            toast({
                title: t("login.toasts.invalidEmailTitle"),
                description: t("login.toasts.invalidEmailDescription"),
                variant: "destructive",
            })
            return
        }
        if (isRegister) {
            if (!tosAccepted) {
                toast({
                    title: t("login.toasts.acceptTermsTitle"),
                    description: t("login.toasts.acceptTermsDescription"),
                    variant: "destructive",
                })
                return
            }
            if (RECAPTCHA_SITE_KEY && !recaptchaToken) {
                toast({
                    title: t("login.toasts.completeRecaptchaTitle"),
                    description: t("login.toasts.completeRecaptchaDescription"),
                    variant: "destructive",
                })
                return
            }
        }

        setLoading(true)
        try {
            if (isRegister) {
                const resReg = await fetch(`${API_BASE}/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username,
                        email,
                        password,
                        recaptchaToken: recaptchaToken ?? undefined,
                    }),
                })
                const dataReg = await resReg.json().catch(() => ({}))
                if (!resReg.ok) {
                    toast({
                        title: t("login.toasts.errorTitle"),
                        description: dataReg.error || t("login.toasts.loginFailed"),
                        variant: "destructive",
                    })
                    return
                }
            }

            const resLogin = await fetch(`${API_BASE}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ username, password, rememberMe }),
            })
            const dataLogin = await resLogin.json().catch(() => ({}))
            if (resLogin.ok && dataLogin.token) {
                setTokens(dataLogin.token, rememberMe)
                try {
                    if (rememberMe) {
                        localStorage.setItem("username", dataLogin.username || username)
                    } else {
                        sessionStorage.setItem("username", dataLogin.username || username)
                    }
                } catch {
                    // ignore storage errors
                }
                toast({
                    title: isRegister ? t("login.toasts.accountCreatedTitle") : t("login.toasts.successTitle"),
                    description: isRegister ? t("login.toasts.accountCreatedDescription") : t("login.toasts.successDescription"),
                })
                router.push("/dashboard")
            } else {
                toast({
                    title: t("login.toasts.errorTitle"),
                    description: dataLogin.error || t("login.toasts.loginFailed"),
                    variant: "destructive",
                })
            }
        } catch (e) {
            console.error(e)
            toast({ title: t("login.toasts.errorTitle"), description: t("login.toasts.unexpectedError"), variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    const getScoreColor = () => {
        switch (score) {
            case 0:
                return "bg-red-500"
            case 1:
                return "bg-orange-500"
            case 2:
                return "bg-yellow-500"
            case 3:
                return "bg-blue-500"
            case 4:
                return "bg-green-500"
            default:
                return "bg-gray-200"
        }
    }

    const recaptchaEnabled = isRegister && !!RECAPTCHA_SITE_KEY

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
        <div className="absolute top-4 left-4 flex items-center gap-2">
            <Link href="/">
                <Button variant="outline" size="sm" className="font-semibold">
                    {t("common.backToHome")}
                </Button>
            </Link>
        </div>
            <div className="absolute top-4 right-4 flex gap-2">
                <LanguageToggle className="w-[150px]" />
                <ThemeToggle />
            </div>

            <Card className="w-full max-w-md shadow-lg border-2">
                <CardHeader>
                    <CardTitle className="text-2xl text-center">
                        {isRegister ? t("login.signUpTitle") : t("login.signInTitle")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input
                        placeholder={t("login.usernamePlaceholder")}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="h-11"
                        onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                    />

                    {isRegister && (
                        <Input
                            placeholder={t("login.emailPlaceholder")}
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="h-11"
                            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                        />
                    )}

                    <div className="space-y-2">
                        <Input
                            type="password"
                            placeholder={t("login.passwordPlaceholder")}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-11"
                            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                        />

                        {isRegister && password && (
                            <div className="space-y-1.5 pt-1">
                                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                                    <span>
                                        {t("login.strengthLabel")} {strengthLevels[score] || ""}
                                    </span>
                                    <span>
                                        {t("login.crackTimeLabel")} {crackTime}
                                    </span>
                                </div>
                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-500 ease-out ${getScoreColor()}`}
                                        style={{ width: `${(score + 1) * 20}%` }}
                                    />
                                </div>
                                <div className="text-[11px] text-muted-foreground">{t("login.passwordRequirement")}</div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                        <input
                            id="remember"
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        <label htmlFor="remember" className="select-none cursor-pointer">
                            {t("login.rememberMe")}
                        </label>
                        {!isRegister && (
                            <button
                                className="ml-auto text-sm text-primary hover:underline"
                                type="button"
                                onClick={() => router.push("/forgot")}
                            >
                                {t("login.forgotPassword")}
                            </button>
                        )}
                    </div>

                    {isRegister && (
                        <div className="flex items-center gap-2 text-sm">
                            <input
                                id="tos"
                                type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={tosAccepted}
                            onChange={(e) => setTosAccepted(e.target.checked)}
                        />
                        <label htmlFor="tos" className="select-none cursor-pointer">
                                {t("login.acceptTos")}
                            </label>
                        </div>
                    )}

                    {recaptchaEnabled && (
                        <div className="flex justify-center">
                            <ReCAPTCHA
                                sitekey={RECAPTCHA_SITE_KEY}
                                onChange={(token) => setRecaptchaToken(token)}
                                onExpired={() => setRecaptchaToken(null)}
                                onErrored={() => setRecaptchaToken(null)}
                            />
                        </div>
                    )}

                    <Button className="w-full h-11 text-base mt-2" onClick={handleAuth} disabled={loading}>
                        {loading ? t("login.buttonWait") : isRegister ? t("login.buttonSignUp") : t("login.buttonLogin")}
                    </Button>
                    <PrivacyTermsNote />

                    <div className="text-center pt-2">
                        <button
                            className="text-sm text-primary hover:underline font-medium"
                            onClick={() => {
                                setIsRegister(!isRegister)
                                setPassword("")
                                setEmail("")
                                setScore(0)
                                setRecaptchaToken(null)
                                setTosAccepted(false)
                            }}
                        >
                            {isRegister ? t("login.toggleToLogin") : t("login.toggleToSignup")}
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

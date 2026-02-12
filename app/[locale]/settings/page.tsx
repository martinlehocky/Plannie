"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, FloppyDisk, ShieldCheck, Globe, Trash } from "phosphor-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core"
import * as zxcvbnCommonPackage from "@zxcvbn-ts/language-common"
import * as zxcvbnEnPackage from "@zxcvbn-ts/language-en"
import { fetchWithAuth, clearTokens, getAccessToken, getStoredUsername, ensureAuth } from "@/lib/api"
import { PrivacyTermsNote } from "@/components/privacy-terms-note"
import { useTranslations } from "next-intl"
import { ThemeToggle } from "@/components/theme-toggle"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"

// zxcvbn init
const options = {
    translations: zxcvbnEnPackage.translations,
    graphs: zxcvbnCommonPackage.adjacencyGraphs,
    dictionary: {
        ...zxcvbnCommonPackage.dictionary,
        ...zxcvbnEnPackage.dictionary,
    },
}
zxcvbnOptions.setOptions(options)

const usernameRe = /^[a-zA-Z0-9]{3,30}$/
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const passwordValid = (p: string) => {
    if (p.length === 0) return true // allow empty when not changing
    const hasDigit = /[0-9]/.test(p)
    const hasSpec = /[!@#$%^&*()\-\_\+=\{\}\[\]:;"'<>,\.?\/\\|]/.test(p)
    return p.length >= 8 && hasDigit && hasSpec
}

export default function SettingsPage() {
    const router = useRouter()
    const { toast } = useToast()
    const tSettings = useTranslations("settings")
    const tCommon = useTranslations("common")

    const [username, setUsername] = useState("")
    const [email, setEmail] = useState("")
    const [preferredTimezone, setPreferredTimezone] = useState("")
    const [oldPassword, setOldPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [deletePassword, setDeletePassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [score, setScore] = useState(0)
    const [crackTime, setCrackTime] = useState("")
    const [passwordsMatch, setPasswordsMatch] = useState(true)

    useEffect(() => {
        const init = async () => {
            const hasAuth = await ensureAuth()
            if (!hasAuth) {
                router.replace("/login")
                return
            }
            setUsername(getStoredUsername() || "")
        }
        init()
        const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone
        const savedTz = localStorage.getItem("preferredTimezone")
        setPreferredTimezone(savedTz || systemTz)
    }, [router])

    const timezones = Intl.supportedValuesOf("timeZone")

    useEffect(() => {
        if (newPassword) {
            const result = zxcvbn(newPassword)
            setScore(result.score)
            setCrackTime(result.crackTimesDisplay.offlineSlowHashing1e4PerSecond)
        } else {
            setScore(0)
            setCrackTime("")
        }
        setPasswordsMatch(newPassword === confirmPassword)
    }, [newPassword, confirmPassword])

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

    const handleSave = async () => {
        const token = getAccessToken()
        if (!token) {
            clearTokens()
            router.replace("/login")
            return
        }

        // Local validation
        if (!usernameRe.test(username)) {
            toast({ title: tSettings("toasts.invalidUsername"), description: tSettings("toasts.invalidUsernameDescription"), variant: "destructive" })
            return
        }
        if (email && !emailRe.test(email)) {
            toast({ title: tSettings("toasts.invalidEmail"), description: tSettings("toasts.invalidEmailDescription"), variant: "destructive" })
            return
        }
        if (newPassword && !passwordValid(newPassword)) {
            toast({
                title: tSettings("toasts.weakPassword"),
                description: tSettings("toasts.weakPasswordDescription"),
                variant: "destructive",
            })
            return
        }
        if (newPassword && !passwordsMatch) {
            toast({ title: tSettings("toasts.error"), description: tSettings("toasts.passwordsDoNotMatch"), variant: "destructive" })
            return
        }
        if (newPassword && !oldPassword) {
            toast({ title: tSettings("toasts.error"), description: tSettings("toasts.enterCurrentPassword"), variant: "destructive" })
            return
        }

        // Save timezone locally
        localStorage.setItem("preferredTimezone", preferredTimezone)

        setLoading(true)
        try {
            const res = await fetchWithAuth(`${API_BASE}/users/me`, {
                method: "PUT",
                body: JSON.stringify({
                    username,
                    email: email || undefined,
                    oldPassword: oldPassword || undefined,
                    newPassword: newPassword || undefined,
                }),
            })

            const data = await res.json().catch(() => ({}))
            if (res.status === 401) {
                clearTokens()
                router.replace("/login")
                return
            }
            if (res.ok) {
                if (data.username) {
                    try {
                        const hadSession = !!sessionStorage.getItem("token")
                        if (hadSession) {
                            sessionStorage.setItem("username", data.username)
                            localStorage.removeItem("username")
                        } else {
                            localStorage.setItem("username", data.username)
                        }
                    } catch {
                        // ignore
                    }
                    localStorage.setItem("username", data.username)
                    setUsername(data.username)
                }
                toast({ title: tSettings("toasts.success"), description: tSettings("toasts.settingsUpdated") })
                setOldPassword("")
                setNewPassword("")
                setConfirmPassword("")
            } else {
                toast({ title: tSettings("toasts.error"), description: data.error || tSettings("toasts.failedToUpdate"), variant: "destructive" })
            }
        } catch (e) {
            toast({ title: tSettings("toasts.error"), description: tSettings("toasts.failedToConnect"), variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        const token = getAccessToken()
        if (!token) {
            clearTokens()
            router.replace("/login")
            return
        }
        if (!deletePassword) {
            toast({ title: tSettings("toasts.passwordRequired"), description: tSettings("toasts.passwordRequiredDescription"), variant: "destructive" })
            return
        }
        const confirmed = window.confirm(
            "This will permanently delete your account and all associated data. This action cannot be undone. Continue?",
        )
        if (!confirmed) return

        setDeleteLoading(true)
        try {
            const res = await fetchWithAuth(`${API_BASE}/users/me`, {
                method: "DELETE",
                body: JSON.stringify({ password: deletePassword }),
            })
            const data = await res.json().catch(() => ({}))
            if (res.status === 401) {
                clearTokens()
                router.replace("/login")
                return
            }
            if (res.ok) {
                toast({ title: tSettings("toasts.accountDeleted"), description: tSettings("toasts.accountDeletedDescription") })
                clearTokens()
                router.replace("/login")
            } else {
                toast({ title: tSettings("toasts.error"), description: data.error || tSettings("toasts.couldNotDelete"), variant: "destructive" })
            }
        } catch {
            toast({ title: tSettings("toasts.error"), description: tSettings("toasts.failedToConnect"), variant: "destructive" })
        } finally {
            setDeleteLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-background p-4 flex items-center justify-center relative">
            {/* Corner toggle (theme only, language is in footer) */}
            <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
                <ThemeToggle />
            </div>

            <Card className="w-full max-w-md">
                <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <Button variant="ghost" size="icon" onClick={() => router.back()}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <CardTitle>{tSettings("title")}</CardTitle>
                    </div>
                    <CardDescription>{tSettings("description")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* General Settings */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium flex items-center gap-2 text-primary">
                            <Globe className="h-4 w-4" /> {tSettings("general")}
                        </h3>
                        <div className="space-y-2">
                            <Label htmlFor="username">{tSettings("username")}</Label>
                            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
                            <p className="text-[11px] text-muted-foreground">{tSettings("usernameHint")}</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">{tSettings("email")}</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={tSettings("emailPlaceholder")}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                {tSettings("emailHint")}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>{tSettings("displayTimezone")}</Label>
                            <Select value={preferredTimezone} onValueChange={setPreferredTimezone}>
                                <SelectTrigger>
                                    <SelectValue placeholder={tSettings("selectTimezone")} />
                                </SelectTrigger>
                                <SelectContent className="h-64">
                                    {timezones.map((tz) => (
                                        <SelectItem key={tz} value={tz}>
                                            {tz.replace(/_/g, " ")}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <hr className="border-muted" />

                    {/* Password Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium flex items-center gap-2 text-primary">
                            <ShieldCheck className="h-4 w-4" /> {tSettings("security")}
                        </h3>

                        <div className="space-y-2">
                            <Label htmlFor="oldPass">{tSettings("currentPassword")}</Label>
                            <Input
                                id="oldPass"
                                type="password"
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                placeholder={tSettings("currentPasswordPlaceholder")}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="newPass">{tSettings("newPassword")}</Label>
                            <Input
                                id="newPass"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder={tSettings("newPasswordPlaceholder")}
                            />

                            {newPassword && (
                                <div className="space-y-2 mt-2">
                                    <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-300 ${getScoreColor()}`}
                                            style={{ width: `${(score + 1) * 20}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground text-right">
                                        {tSettings("crackTime")} <span className="font-medium">{crackTime}</span>
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {tSettings("passwordRequirement")}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPass" className={!passwordsMatch && newPassword ? "text-destructive" : ""}>
                                {tSettings("confirmNewPassword")}
                            </Label>
                            <Input
                                id="confirmPass"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className={!passwordsMatch && confirmPassword ? "border-destructive" : ""}
                            />
                        </div>
                    </div>

                    <Button className="w-full gap-2 mt-4" onClick={handleSave} disabled={loading}>
                        <FloppyDisk className="h-4 w-4" />
                        {loading ? tSettings("saving") : tSettings("saveChanges")}
                    </Button>

                    <hr className="border-muted" />

                    {/* Danger Zone */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-destructive flex items-center gap-2">
                            <Trash className="h-4 w-4" />
                            {tSettings("dangerZone")}
                        </h3>
                        <p className="text-[12px] text-muted-foreground">
                            {tSettings("dangerZoneDescription")}
                        </p>
                        <div className="space-y-2">
                            <Label htmlFor="deletePass">{tSettings("confirmWithPassword")}</Label>
                            <Input
                                id="deletePass"
                                type="password"
                                value={deletePassword}
                                onChange={(e) => setDeletePassword(e.target.value)}
                                placeholder={tSettings("currentPasswordPlaceholderDelete")}
                            />
                        </div>
                        <Button
                            variant="destructive"
                            className="w-full gap-2"
                            onClick={handleDelete}
                            disabled={deleteLoading}
                        >
                            <Trash className="h-4 w-4" />
                            {deleteLoading ? tSettings("deleting") : tSettings("deleteMyAccount")}
                        </Button>
                    </div>

                    <PrivacyTermsNote className="mt-2" />
                </CardContent>
            </Card>
        </div>
    )
}
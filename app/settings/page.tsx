"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Save, ShieldCheck, Globe } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core"
import * as zxcvbnCommonPackage from "@zxcvbn-ts/language-common"
import * as zxcvbnEnPackage from "@zxcvbn-ts/language-en"
import { fetchWithAuth, clearTokens } from "@/lib/api"

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
const passwordValid = (p: string) => {
    if (p.length === 0) return true // allow empty when not changing
    const hasDigit = /[0-9]/.test(p)
    const hasSpec = /[!@#$%^&*()\-\_\+=\{\}\[\]:;"'<>,\.?\/\\|]/.test(p)
    return p.length >= 8 && hasDigit && hasSpec
}

export default function SettingsPage() {
    const router = useRouter()
    const { toast } = useToast()

    const [username, setUsername] = useState("")
    const [preferredTimezone, setPreferredTimezone] = useState("")
    const [oldPassword, setOldPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [score, setScore] = useState(0)
    const [crackTime, setCrackTime] = useState("")
    const [passwordsMatch, setPasswordsMatch] = useState(true)

    useEffect(() => {
        const token = localStorage.getItem("token")
        if (!token) {
            router.replace("/login")
            return
        }
        setUsername(localStorage.getItem("username") || "")
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
        const token = localStorage.getItem("token")
        if (!token) {
            clearTokens()
            router.replace("/login")
            return
        }

        // Local validation
        if (!usernameRe.test(username)) {
            toast({ title: "Invalid username", description: "Use 3-30 alphanumeric characters.", variant: "destructive" })
            return
        }
        if (newPassword && !passwordValid(newPassword)) {
            toast({
                title: "Weak password",
                description: "At least 8 chars with a number and a special character.",
                variant: "destructive",
            })
            return
        }
        if (newPassword && !passwordsMatch) {
            toast({ title: "Error", description: "New passwords do not match.", variant: "destructive" })
            return
        }
        if (newPassword && !oldPassword) {
            toast({ title: "Error", description: "Please enter your current password.", variant: "destructive" })
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
                    localStorage.setItem("username", data.username)
                    setUsername(data.username)
                }
                toast({ title: "Success", description: "Settings updated successfully." })
                setOldPassword("")
                setNewPassword("")
                setConfirmPassword("")
            } else {
                toast({ title: "Error", description: data.error || "Failed to update settings", variant: "destructive" })
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to connect.", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-background p-4 flex items-center justify-center">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <Button variant="ghost" size="icon" onClick={() => router.back()}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <CardTitle>Settings</CardTitle>
                    </div>
                    <CardDescription>Manage your account and preferences.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* General Settings */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium flex items-center gap-2 text-primary">
                            <Globe className="h-4 w-4" /> General
                        </h3>
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
                            <p className="text-[11px] text-muted-foreground">3–30 chars, letters and numbers only.</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Display Timezone</Label>
                            <Select value={preferredTimezone} onValueChange={setPreferredTimezone}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select timezone" />
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
                            <ShieldCheck className="h-4 w-4" /> Security
                        </h3>

                        <div className="space-y-2">
                            <Label htmlFor="oldPass">Current Password</Label>
                            <Input
                                id="oldPass"
                                type="password"
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                placeholder="Required to change password"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="newPass">New Password</Label>
                            <Input
                                id="newPass"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Leave blank to keep current password"
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
                                        Crack time: <span className="font-medium">{crackTime}</span>
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        Must be ≥8 chars and include a number and a special character.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPass" className={!passwordsMatch && newPassword ? "text-destructive" : ""}>
                                Confirm New Password
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
                        <Save className="h-4 w-4" />
                        {loading ? "Saving..." : "Save Changes"}
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
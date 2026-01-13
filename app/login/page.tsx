"use client"

import { useState, useEffect } from "react"
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"

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

    const router = useRouter()
    const { toast } = useToast()

    // Password strength meter
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

    // Match backend rules: >=8 chars with a number and a special character
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

    const handleAuth = async () => {
        if (!username || !password) {
            toast({ title: "Missing fields", description: "Username and password are required.", variant: "destructive" })
            return
        }
        if (isRegister && !passwordLooksValid()) {
            toast({
                title: "Password too weak",
                description: "Use at least 8 characters with a number and a special character.",
                variant: "destructive",
            })
            return
        }
        if (isRegister && !emailLooksValid()) {
            toast({
                title: "Invalid email",
                description: "Please enter a valid email address.",
                variant: "destructive",
            })
            return
        }

        setLoading(true)
        try {
            if (isRegister) {
                // Register (now requires email)
                const resReg = await fetch(`${API_BASE}/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, email, password }),
                })
                const dataReg = await resReg.json().catch(() => ({}))
                if (!resReg.ok) {
                    toast({ title: "Error", description: dataReg.error || "Could not register", variant: "destructive" })
                    return
                }
            }

            // Login (for both signup flow and direct login)
            const resLogin = await fetch(`${API_BASE}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include", // receive HttpOnly refresh cookie
                body: JSON.stringify({ username, password, rememberMe }),
            })
            const dataLogin = await resLogin.json().catch(() => ({}))
            if (resLogin.ok && dataLogin.token) {
                // Store access token in localStorage if rememberMe, otherwise sessionStorage
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
                    title: isRegister ? "Account created" : "Success",
                    description: isRegister ? "You are now signed in." : "Welcome back!",
                })
                router.push("/dashboard")
            } else {
                toast({ title: "Error", description: dataLogin.error || "Login failed", variant: "destructive" })
            }
        } catch (e) {
            console.error(e)
            toast({ title: "Error", description: "Unexpected error", variant: "destructive" })
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

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
            <div className="absolute top-4 left-4 flex items-center gap-2">
                <Link href="/">
                    <Button variant="outline" size="sm" className="font-semibold">
                        ← Back to Home
                    </Button>
                </Link>
            </div>
            <div className="absolute top-4 right-4">
                <ThemeToggle />
            </div>

            <Card className="w-full max-w-md shadow-lg border-2">
                <CardHeader>
                    <CardTitle className="text-2xl text-center">{isRegister ? "Create Account" : "Sign In"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="h-11"
                        onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                    />

                    {isRegister && (
                        <Input
                            placeholder="Email"
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
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-11"
                            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                        />

                        {isRegister && password && (
                            <div className="space-y-1.5 pt-1">
                                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                                    <span>Strength: {["Risk", "Weak", "Fair", "Good", "Strong"][score]}</span>
                                    <span>Crack time: {crackTime}</span>
                                </div>
                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-500 ease-out ${getScoreColor()}`}
                                        style={{ width: `${(score + 1) * 20}%` }}
                                    />
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                    Must be ≥8 chars and include a number and a special character.
                                </div>
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
                            Remember me
                        </label>
                        {!isRegister && (
                            <button
                                className="ml-auto text-sm text-primary hover:underline"
                                type="button"
                                onClick={() => router.push("/forgot")}
                            >
                                Forgot password?
                            </button>
                        )}
                    </div>

                    <Button className="w-full h-11 text-base mt-2" onClick={handleAuth} disabled={loading}>
                        {loading ? "Please wait..." : isRegister ? "Sign Up" : "Login"}
                    </Button>

                    <div className="text-center pt-2">
                        <button
                            className="text-sm text-primary hover:underline font-medium"
                            onClick={() => {
                                setIsRegister(!isRegister)
                                setPassword("")
                                setEmail("")
                                setScore(0)
                            }}
                        >
                            {isRegister ? "Already have an account? Login" : "Need an account? Sign Up"}
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
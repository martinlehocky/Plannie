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
    const [password, setPassword] = useState("")
    const [crackTime, setCrackTime] = useState("")
    const [score, setScore] = useState(0) // 0 to 4
    const [loading, setLoading] = useState(false)

    const router = useRouter()
    const { toast } = useToast()

    // Calculate password strength whenever password changes
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

    const handleAuth = async () => {
        if (!username || !password) {
            toast({ title: "Missing fields", description: "Username and password are required.", variant: "destructive" })
            return
        }
        setLoading(true)
        try {
            if (isRegister) {
                // 1) Register
                const resReg = await fetch(`${API_BASE}/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password }),
                })
                const dataReg = await resReg.json().catch(() => ({}))
                if (!resReg.ok) {
                    toast({ title: "Error", description: dataReg.error || "Could not register", variant: "destructive" })
                    return
                }
                // 2) Auto login to get JWT
                const resLogin = await fetch(`${API_BASE}/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password }),
                })
                const dataLogin = await resLogin.json().catch(() => ({}))
                if (!resLogin.ok || !dataLogin.token) {
                    toast({ title: "Error", description: dataLogin.error || "Login failed after signup", variant: "destructive" })
                    return
                }
                localStorage.setItem("token", dataLogin.token)
                localStorage.setItem("username", dataLogin.username)
                toast({ title: "Account created", description: "You are now signed in." })
                router.push("/dashboard")
            } else {
                // Login
                const res = await fetch(`${API_BASE}/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password }),
                })
                const data = await res.json().catch(() => ({}))
                if (res.ok && data.token) {
                    localStorage.setItem("token", data.token)
                    localStorage.setItem("username", data.username)
                    toast({ title: "Success", description: "Welcome back!" })
                    router.push("/dashboard")
                } else {
                    toast({ title: "Error", description: data.error || "Login failed", variant: "destructive" })
                }
            }
        } catch (e) {
            console.error(e)
            toast({ title: "Error", description: "Unexpected error", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    // Get color for progress bar
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
            <div className="absolute top-4 left-4">
                <Link href="/">
                    <Button variant="outline" size="sm" className="font-semibold">
                        ← Back to Home
                    </Button>
                </Link>
            </div>

            <Card className="w-full max-w-md shadow-lg border-2">
                <CardHeader>
                    <CardTitle className="text-2xl text-center">{isRegister ? "Create Account" : "Sign In"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="h-11" />

                    <div className="space-y-2">
                        <Input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-11"
                            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                        />

                        {/* STRENGTH BAR - Only visible during registration */}
                        {isRegister && password && (
                            <div className="space-y-1.5 pt-1">
                                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                                    <span>Strength: {["Risk", "Weak", "Fair", "Good", "Strong"][score]}</span>
                                    <span>Crack time: {crackTime}</span>
                                </div>
                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                    <div className={`h-full transition-all duration-500 ease-out ${getScoreColor()}`} style={{ width: `${(score + 1) * 20}%` }} />
                                </div>
                            </div>
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
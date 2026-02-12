"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Link } from "@/src/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ThemeToggle } from "@/components/theme-toggle"
import { resetPassword } from "@/lib/api"
import { PrivacyTermsNote } from "@/components/privacy-terms-note"

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
            <ResetPasswordInner />
        </Suspense>
    )
}

function ResetPasswordInner() {
    const search = useSearchParams()
    const [tokenId, setTokenId] = useState("")
    const [token, setToken] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const { toast } = useToast()
    const router = useRouter()

    useEffect(() => {
        const tid = search.get("tid") || ""
        const t = search.get("t") || ""
        if (tid) setTokenId(tid)
        if (t) setToken(t)
    }, [search])

    const submit = async () => {
        if (!tokenId || !token) {
            toast({ title: "Invalid link", description: "The reset link is missing required parameters.", variant: "destructive" })
            return
        }
        if (!password || !confirmPassword) {
            toast({ title: "Missing fields", description: "Please enter and confirm your new password.", variant: "destructive" })
            return
        }
        if (password !== confirmPassword) {
            toast({ title: "Passwords do not match", description: "Please re-enter matching passwords.", variant: "destructive" })
            return
        }

        setLoading(true)
        const res = await resetPassword({ tokenId, token, newPassword: password, confirmNewPassword: confirmPassword })
        if (res.ok) {
            toast({ title: "Password reset", description: "Please sign in with your new password." })
            router.push("/login")
        } else {
            toast({ title: "Error", description: res.error || "Invalid or expired token", variant: "destructive" })
        }
        setLoading(false)
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
                    <CardTitle className="text-2xl text-center">Set a new password</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input
                        type="password"
                        placeholder="New password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submit()}
                    />
                    <Input
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submit()}
                    />
                    <Button className="w-full h-11 text-base mt-2" onClick={submit} disabled={loading}>
                        {loading ? "Updating..." : "Reset password"}
                    </Button>
                    <PrivacyTermsNote />
                    <div className="text-center text-sm">
                        <Link href="/login" className="text-primary hover:underline">
                            Back to sign in
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

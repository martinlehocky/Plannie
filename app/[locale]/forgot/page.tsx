"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Link } from "@/src/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ThemeToggle } from "@/components/theme-toggle"
import { forgotPassword } from "@/lib/api"
import { PrivacyTermsNote } from "@/components/privacy-terms-note"

export default function ForgotPage() {
    const [email, setEmail] = useState("")
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const { toast } = useToast()

    const submit = async () => {
        if (!email) return
        setLoading(true)
        try {
            await forgotPassword(email)
            toast({ title: "If the account exists, a reset link was sent." })
            router.push("/login")
        } catch {
            toast({ title: "If the account exists, a reset link was sent." })
        } finally {
            setLoading(false)
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
                    <CardTitle className="text-2xl text-center">Reset password</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input
                        placeholder="Email or username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submit()}
                    />
                    <Button className="w-full h-11 text-base mt-2" onClick={submit} disabled={loading || !email}>
                        {loading ? "Sending..." : "Send reset link"}
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

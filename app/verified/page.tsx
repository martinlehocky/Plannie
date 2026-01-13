"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"

export default function VerifiedPage() {
    const search = useSearchParams()
    const router = useRouter()
    const success = search.get("success") === "1"

    useEffect(() => {
        // Optionally auto-redirect after a delay
        const timer = setTimeout(() => {
            router.push("/login")
        }, 4000)
        return () => clearTimeout(timer)
    }, [router])

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
                    <CardTitle className="text-2xl text-center">{success ? "Email verified" : "Verification failed"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                    {success ? (
                        <p className="text-sm text-muted-foreground">Your email has been verified. You can sign in now.</p>
                    ) : (
                        <p className="text-sm text-muted-foreground">The verification link is invalid or expired.</p>
                    )}
                    <Button asChild className="w-full">
                        <Link href="/login">{success ? "Go to login" : "Try again"}</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
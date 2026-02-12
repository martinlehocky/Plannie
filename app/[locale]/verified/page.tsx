"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Link } from "@/src/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"

export default function VerifiedPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
            <VerifiedInner />
        </Suspense>
    )
}

function VerifiedInner() {
    const search = useSearchParams()
    const [success, setSuccess] = useState<string | null>(null)

    useEffect(() => {
        const s = search.get("success")
        setSuccess(s)
    }, [search])

    const ok = success === "1"

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
                    <CardTitle className="text-2xl text-center">
                        {ok ? "Email verified" : "Verification failed"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                    {ok ? (
                        <p>Your email has been successfully verified. You can now sign in.</p>
                    ) : (
                        <p>The verification link is invalid or has expired.</p>
                    )}
                    <div className="flex justify-center gap-3">
                        <Link href="/login">
                            <Button className="font-semibold">Go to Sign In</Button>
                        </Link>
                        <Link href="/">
                            <Button variant="outline" className="font-semibold">
                                Home
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
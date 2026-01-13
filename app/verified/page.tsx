"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useEffect } from "react"

export default function VerifiedPage() {
    const search = useSearchParams()
    const success = search?.get("success")
    const router = useRouter()

    useEffect(() => {
        // Auto-redirect to home after 3s
        const t = setTimeout(() => router.push("/"), 3000)
        return () => clearTimeout(t)
    }, [router])

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <div className="w-full max-w-md text-center">
                {success === "1" ? (
                    <>
                        <h1 className="text-2xl mb-2">Email verified</h1>
                        <p className="mb-4">Thanks — your email was verified. Redirecting to home...</p>
                    </>
                ) : (
                    <>
                        <h1 className="text-2xl mb-2">Verification failed</h1>
                        <p className="mb-4">The link may be expired or invalid. Check your email or request a new verification.</p>
                    </>
                )}
            </div>
        </div>
    )
}
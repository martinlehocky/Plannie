"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("")
    const [loading, setLoading] = useState(false)
    const { toast } = useToast()
    const router = useRouter()

    const submit = async () => {
        setLoading(true)
        try {
            await fetch(`${API_BASE}/forgot-password`, {
                method: "POST",
                headers: {"Content-Type":"application/json"},
                body: JSON.stringify({ email }),
            })
            toast({ title: "If an account exists", description: "If an account exists we sent a reset link", })
            router.push("/")
        } catch {
            toast({ title: "Error", description: "Unexpected error", variant: "destructive" })
        } finally { setLoading(false) }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <div className="w-full max-w-md">
                <h1 className="text-2xl mb-4">Forgot password</h1>
                <Input placeholder="Email or username" value={email} onChange={(e)=>setEmail(e.target.value)} />
                <Button className="mt-4" onClick={submit} disabled={loading}>{loading ? "Sending..." : "Send reset link"}</Button>
            </div>
        </div>
    )
}
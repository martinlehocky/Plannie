"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"

export default function ResetPasswordPage() {
    const search = useSearchParams()
    const tid = search?.get("tid") ?? ""
    const t = search?.get("t") ?? ""
    const [pw, setPw] = useState("")
    const [loading, setLoading] = useState(false)
    const { toast } = useToast()
    const router = useRouter()

    const submit = async () => {
        if (!pw) { toast({title:"Missing", description:"Enter a new password", variant:"destructive"}); return }
        setLoading(true)
        try {
            const res = await fetch(`${API_BASE}/reset-password`, {
                method: "POST",
                headers: {"Content-Type":"application/json"},
                body: JSON.stringify({ tokenId: tid, token: t, newPassword: pw }),
            })
            if (res.ok) {
                toast({ title: "Password updated", description: "You can now sign in." })
                router.push("/")
            } else {
                const d = await res.json().catch(()=>({}))
                toast({ title: "Error", description: d.error || "Could not reset", variant: "destructive" })
            }
        } catch {
            toast({ title: "Error", description: "Unexpected error", variant: "destructive" })
        } finally { setLoading(false) }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <div className="w-full max-w-md">
                <h1 className="text-2xl mb-4">Reset password</h1>
                <Input type="password" placeholder="New password" value={pw} onChange={(e)=>setPw(e.target.value)} />
                <Button className="mt-4" onClick={submit} disabled={loading}>Set new password</Button>
            </div>
        </div>
    )
}
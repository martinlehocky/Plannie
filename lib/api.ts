// Simple token helpers
const authDebug = (...args: unknown[]) => {
    if (typeof window !== "undefined") console.debug("[auth-debug]", ...args)
}

export const setTokens = (access: string, remember = true) => {
    if (typeof window === "undefined") return
    try {
        if (remember) {
            localStorage.setItem("token", access)
        } else {
            sessionStorage.setItem("token", access)
        }
    } catch {
        // storage might be disabled or throw in private mode — ignore
    }
}

export const clearTokens = () => {
    if (typeof window === "undefined") return
    try {
        localStorage.removeItem("token")
        localStorage.removeItem("refresh_token") // legacy cleanup
        localStorage.removeItem("username")
        sessionStorage.removeItem("token")
        sessionStorage.removeItem("refresh_token")
        sessionStorage.removeItem("username")
    } catch {
        // ignore
    }
}

// Return undefined instead of null to satisfy token?: string
export const getAccessToken = () =>
    typeof window !== "undefined"
        ? (sessionStorage.getItem("token") || localStorage.getItem("token") || undefined)
        : undefined

export const getStoredUsername = () =>
    typeof window !== "undefined"
        ? (sessionStorage.getItem("username") || localStorage.getItem("username") || undefined)
        : undefined

// Refresh flow using HttpOnly refresh cookie
export const refreshAccessToken = async () => {
    const hadSession = typeof window !== "undefined" && !!sessionStorage.getItem("token")
    const hadLocal = typeof window !== "undefined" && !!localStorage.getItem("token")
    authDebug("refreshAccessToken:start", { hadSession, hadLocal })
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}/refresh`,
        {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: "{}", // cookie carries the refresh token
        }
    )
    authDebug("refreshAccessToken:response", { status: res.status, ok: res.ok })

    if (res.status === 400 || res.status === 401) {
        authDebug("refreshAccessToken:auth-failed", { status: res.status })
        throw new Error("refresh_auth")
    }
    if (!res.ok) {
        authDebug("refreshAccessToken:server-failed", { status: res.status })
        throw new Error("refresh failed")
    }

    const data = await res.json()
    if (data.token) {
        try {
            if (hadSession && !hadLocal) {
                sessionStorage.setItem("token", data.token)
                authDebug("refreshAccessToken:stored-token", { storage: "sessionStorage" })
            } else {
                localStorage.setItem("token", data.token)
                authDebug("refreshAccessToken:stored-token", { storage: "localStorage" })
            }
        } catch {
            // ignore
        }
        return data.token as string
    }
    throw new Error("invalid refresh response")
}

export const ensureAuth = async () => {
    const token = getAccessToken()
    if (token) return true
    try {
        await refreshAccessToken()
        return true
    } catch {
        return false
    }
}

// fetchWithAuth: retries once after refresh on 401; on refresh failure returns a 401 response
export const fetchWithAuth = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const doFetch = async (token?: string): Promise<Response> => {
        const headers = new Headers(init.headers || {})
        if (token) headers.set("Authorization", `Bearer ${token}`)
        if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json")
        return fetch(input, { ...init, headers, credentials: "include" })
    }

    const current = getAccessToken()
    let res = await doFetch(current)
    if (res.status === 401) {
        authDebug("fetchWithAuth:initial-401", { url: String(input) })
        try {
            const newToken = await refreshAccessToken()
            res = await doFetch(newToken)
            authDebug("fetchWithAuth:retry-result", { url: String(input), status: res.status })
        } catch {
            authDebug("fetchWithAuth:refresh-failed", { url: String(input) })
            clearTokens()
            return new Response(null, { status: 401 })
        }
    }
    return res
}

// Optional: call this on logout
export const logout = async () => {
    try {
        await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}/logout`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: "{}",
        })
    } catch {
        // ignore network errors on logout
    } finally {
        clearTokens()
    }
}

// New helpers for password reset flows
export const forgotPassword = async (emailOrUsername: string) => {
    return fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailOrUsername }),
    })
}

export const resetPassword = async (args: { tokenId: string; token: string; newPassword: string; confirmNewPassword: string }) => {
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tokenId: args.tokenId,
                token: args.token,
                newPassword: args.newPassword,
                confirmNewPassword: args.confirmNewPassword,
            }),
        })
        const data = await res.json().catch(() => ({}))
        return { ok: res.ok, error: data.error as string | undefined }
    } catch {
        return { ok: false, error: "Network error" }
    }
}

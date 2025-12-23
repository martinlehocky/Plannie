// Simple token helpers
export const setTokens = (access: string, _refresh?: string) => {
    localStorage.setItem("token", access)
}

export const clearTokens = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("refresh_token") // legacy cleanup
    localStorage.removeItem("username")
}

// Return undefined instead of null to satisfy token?: string
export const getAccessToken = () =>
    typeof window !== "undefined" ? localStorage.getItem("token") || undefined : undefined

// Refresh flow using HttpOnly refresh cookie
const refreshAccessToken = async () => {
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}/refresh`,
        {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: "{}", // cookie carries the refresh token
        }
    )

    // Treat missing/expired refresh cookie as auth failure
    if (res.status === 400 || res.status === 401) {
        throw new Error("refresh_auth")
    }
    if (!res.ok) throw new Error("refresh failed")

    const data = await res.json()
    if (data.token) {
        setTokens(data.token)
        return data.token as string
    }
    throw new Error("invalid refresh response")
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
        try {
            const newToken = await refreshAccessToken()
            res = await doFetch(newToken)
        } catch {
            // refresh failed (likely expired/missing cookie) — clear and signal auth failure
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
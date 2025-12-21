// Simple token helpers
export const setTokens = (access?: string | null) => {
    if (!access) {
        clearTokens()
        return
    }
    localStorage.setItem("token", access)
}

export const clearTokens = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("refresh_token") // legacy cleanup
    localStorage.removeItem("username")
}

export const getAccessToken = (): string | undefined =>
    typeof window !== "undefined" ? localStorage.getItem("token") ?? undefined : undefined

// Refresh flow using HttpOnly refresh cookie
const refreshAccessToken = async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
    })
    if (!res.ok) throw new Error("refresh failed")
    const data = await res.json()
    if (data.token) {
        setTokens(data.token)
        return data.token as string
    }
    throw new Error("invalid refresh response")
}

// fetchWithAuth: retries once after refresh on 401
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
            clearTokens()
            throw new Error("auth_failed")
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
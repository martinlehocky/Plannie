// Simple token helpers
export const setTokens = (access: string, refresh: string) => {
    localStorage.setItem("token", access)
    localStorage.setItem("refresh_token", refresh)
}
export const clearTokens = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("refresh_token")
    localStorage.removeItem("username")
}
export const getAccessToken = () => (typeof window !== "undefined" ? localStorage.getItem("token") : null)
const getRefreshToken = () => (typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null)

// Refresh flow
const refreshAccessToken = async () => {
    const rt = getRefreshToken()
    if (!rt) throw new Error("no refresh token")
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
    })
    if (!res.ok) throw new Error("refresh failed")
    const data = await res.json()
    if (data.token && data.refresh_token) {
        setTokens(data.token, data.refresh_token)
        return data.token as string
    }
    throw new Error("invalid refresh response")
}

// fetchWithAuth: retries once after refresh on 401
export const fetchWithAuth = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const doFetch = async (): Promise<Response> => {
        const t = getAccessToken()
        const headers = new Headers(init.headers || {})
        if (t) headers.set("Authorization", `Bearer ${t}`)
        headers.set("Content-Type", headers.get("Content-Type") || "application/json")
        return fetch(input, { ...init, headers })
    }

    let res = await doFetch()
    if (res.status === 401) {
        try {
            const newToken = await refreshAccessToken()
            const headers = new Headers(init.headers || {})
            headers.set("Authorization", `Bearer ${newToken}`)
            headers.set("Content-Type", headers.get("Content-Type") || "application/json")
            res = await fetch(input, { ...init, headers })
        } catch {
            clearTokens()
            throw new Error("auth_failed")
        }
    }
    return res
}
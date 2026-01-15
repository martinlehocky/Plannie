"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Clock } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import { useTranslations } from "@/components/language-provider"
import type { DateRange } from "react-day-picker"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { fetchWithAuth, clearTokens, logout, getAccessToken, getStoredUsername } from "@/lib/api"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"

export default function Home() {
  const router = useRouter()
  const { toast } = useToast()
  const { t } = useTranslations()

  const [eventName, setEventName] = useState("")
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [duration, setDuration] = useState("30")
  const [customDuration, setCustomDuration] = useState("")
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const token = getAccessToken()
    setIsLoggedIn(!!token)
  }, [])

  const handleLogout = async () => {
    await logout()
    setIsLoggedIn(false)
    toast({ title: t("create.toasts.signedOutTitle"), description: t("create.toasts.signedOutDescription") })
  }

  const handleCreateEvent = async () => {
    if (!isLoggedIn) {
      toast({
        title: t("create.toasts.signInRequiredTitle"),
        description: t("create.toasts.signInRequiredDescription"),
        variant: "destructive",
      })
      router.push("/login")
      return
    }
    if (!eventName || !dateRange?.from || !dateRange?.to) return

    let finalDuration = Number.parseInt(duration)
    if (duration === "custom") {
      finalDuration = Number.parseInt(customDuration)
      if (isNaN(finalDuration) || finalDuration <= 0) {
        toast({
          title: t("create.toasts.invalidDurationTitle"),
          description: t("create.toasts.invalidDurationDescription"),
          variant: "destructive",
        })
        return
      }
    }

    setIsSubmitting(true)

    const eventId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10)

    const eventData = {
      id: eventId,
      name: eventName,
      dateRange: {
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
      },
      duration: finalDuration,
      timezone,
      participants: [],
      disabledSlots: [],
    }

    try {
      const response = await fetchWithAuth(`${API_BASE}/events`, {
        method: "POST",
        body: JSON.stringify(eventData),
      })

      if (!response.ok) {
        if (response.status === 401) {
          clearTokens()
          setIsLoggedIn(false)
          router.push("/login")
          return
        }
        const d = await response.json().catch(() => ({}))
        throw new Error(d.error || "Failed to create event")
      }

      // Navigate to the singular route
      router.push(`/event/${eventId}`)
    } catch (error) {
      console.error("Error creating event:", error)
      toast({
        title: t("create.toasts.errorTitle"),
        description: t("create.toasts.errorDescription"),
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isButtonDisabled =
      isSubmitting ||
      !isLoggedIn ||
      !eventName ||
      !dateRange?.from ||
      !dateRange?.to ||
      (duration === "custom" && (!customDuration || Number.parseInt(customDuration) <= 0))

  return (
      <div className="min-h-screen bg-background flex flex-col md:justify-center relative">
        <div className="w-full flex justify-end items-center gap-2 p-4 md:absolute md:top-8 md:right-8 md:p-0 z-50">
          {isLoggedIn ? (
              <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="md:h-10 md:px-4 md:py-2 text-xs md:text-sm"
                    onClick={() => router.push("/dashboard")}
                >
                  {t("common.myDashboard")}
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="md:h-10 md:px-4 md:py-2 text-xs md:text-sm"
                    onClick={handleLogout}
                >
                  {t("common.signOut")}
                </Button>
              </div>
          ) : (
              <Button
                  variant="ghost"
                  size="sm"
                  className="md:h-10 md:px-4 md:py-2 text-xs md:text-sm"
                  onClick={() => router.push("/login")}
              >
                {t("common.signInRegister")}
              </Button>
          )}
          <LanguageToggle className="w-[150px]" />
          <ThemeToggle />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 w-full">
          <div className="w-full max-w-4xl grid gap-8">
            <div className="text-center space-y-2">
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight lg:text-7xl">{t("create.heading")}</h1>
              <p className="text-xl text-muted-foreground md:text-2xl">{t("create.subheading")}</p>
            </div>

            <Card className="border-2 shadow-lg">
              <CardHeader>
                <CardTitle>{t("create.cardTitle")}</CardTitle>
                <CardDescription>{t("create.cardDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="eventName">{t("create.eventNameLabel")}</Label>
                      <Input
                          id="eventName"
                          placeholder={t("create.eventNamePlaceholder")}
                          value={eventName}
                          onChange={(e) => setEventName(e.target.value)}
                          className="text-base md:text-lg h-11 md:h-12"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("create.durationLabel")}</Label>
                        <Select value={duration} onValueChange={setDuration}>
                          <SelectTrigger className="h-11 md:h-12">
                            <Clock className="mr-2 h-4 w-4" />
                            <SelectValue placeholder={t("create.durationPlaceholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15">{t("create.durationOptions.minutes15")}</SelectItem>
                            <SelectItem value="30">{t("create.durationOptions.minutes30")}</SelectItem>
                            <SelectItem value="60">{t("create.durationOptions.minutes60")}</SelectItem>
                            <SelectItem value="90">{t("create.durationOptions.minutes90")}</SelectItem>
                            <SelectItem value="120">{t("create.durationOptions.minutes120")}</SelectItem>
                            <SelectItem value="custom">{t("create.durationOptions.custom")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>{t("create.timezoneLabel")}</Label>
                        <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="h-11 md:h-12" disabled />
                      </div>
                    </div>

                    {duration === "custom" && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                          <Label>{t("create.customDurationLabel")}</Label>
                          <Input
                              type="number"
                              placeholder={t("create.customDurationPlaceholder")}
                              value={customDuration}
                              onChange={(e) => setCustomDuration(e.target.value)}
                              className="h-11 md:h-12"
                          />
                        </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{t("create.dateRangeLabel")}</Label>
                    <div className="border rounded-md p-4 flex justify-center bg-card">
                      <Calendar
                          mode="range"
                          selected={dateRange}
                          onSelect={setDateRange}
                          className="rounded-md"
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      />
                    </div>
                    {dateRange?.from && dateRange?.to && (
                        <p className="text-sm text-muted-foreground text-center">
                          {t("create.dateRangeSelected", {
                            from: format(dateRange.from, "MMM dd, yyyy"),
                            to: format(dateRange.to, "MMM dd, yyyy"),
                          })}
                        </p>
                    )}
                  </div>
                </div>

                <Button size="lg" className="w-full text-lg h-12 md:h-14" onClick={handleCreateEvent} disabled={isButtonDisabled}>
                  {isSubmitting ? t("create.buttonCreating") : isLoggedIn ? t("create.buttonCreate") : t("create.buttonSignIn")}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
  )
}

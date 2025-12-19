"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { format, eachDayOfInterval, startOfDay, addDays, subDays, isBefore, isAfter, isSameDay } from "date-fns"
import { cn } from "@/lib/utils"
import { Users } from "lucide-react"

// --- Helper: Calculate Visual Date ---
function getVisualDate(utcKey: string, targetTimezone: string): Date {
  const ts = new Date(utcKey).getTime()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: targetTimezone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric'
  })

  const parts = formatter.formatToParts(new Date(ts))
  const p: Record<string, number> = {}
  parts.forEach(({ type, value }) => {
    if (type !== 'literal') p[type] = parseInt(value, 10)
  })

  return new Date(p.year, p.month - 1, p.day)
}

// --- Helper: Create UTC Key ---
function createUtcKey(date: Date, hour: number, minute: number, targetTimezone: string): string {
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()
  const candidateTimestamp = Date.UTC(year, month, day, hour, minute, 0, 0)

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: targetTimezone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false
  })

  const refDate = new Date(candidateTimestamp)
  const parts = formatter.formatToParts(refDate)
  const p: Record<string, number> = {}
  parts.forEach(({ type, value }) => {
    if (type !== 'literal') p[type] = parseInt(value, 10)
  })

  const visualDateInTarget = new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute))
  const diff = visualDateInTarget.getTime() - refDate.getTime()
  const desiredUtcTime = candidateTimestamp - diff

  return new Date(desiredUtcTime).toISOString()
}

type DateRange = {
  from: Date
  to: Date
}

type Participant = {
  id: string
  name: string
  availability: Record<string, boolean>
}

type AvailabilityGridProps = {
  dateRange: DateRange
  duration?: number
  currentParticipant: Participant
  allParticipants: Participant[]
  onSave: (availability: Record<string, boolean>) => void
  timezone: string
}

export function AvailabilityGrid({
                                   dateRange,
                                   duration = 30,
                                   currentParticipant,
                                   allParticipants,
                                   onSave,
                                   timezone,
                                 }: AvailabilityGridProps) {
  const [availability, setAvailability] = useState<Record<string, boolean>>(currentParticipant.availability || {})
  const [isPainting, setIsPainting] = useState(false)
  const [paintMode, setPaintMode] = useState<boolean | null>(null)
  const [scrollMode, setScrollMode] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  // --- DYNAMIC DATE EXPANSION LOGIC ---
  const expandedDates = useMemo(() => {
    let start = dateRange.from
    let end = dateRange.to

    const allKeys = new Set<string>()
    allParticipants.forEach(p => {
      Object.keys(p.availability).forEach(k => {
        if (p.availability[k]) allKeys.add(k)
      })
    })
    Object.keys(availability).forEach(k => {
      if (availability[k]) allKeys.add(k)
    })

    allKeys.forEach(key => {
      const visualDate = getVisualDate(key, timezone)
      if (isBefore(visualDate, start)) {
        start = visualDate
      }
      if (isAfter(visualDate, end)) {
        end = visualDate
      }
    })

    return eachDayOfInterval({ start, end })
  }, [dateRange, allParticipants, availability, timezone])

  // Generate time slots (0-24)
  const timeRows: { hour: number; minute: number; label: string }[] = []
  const startHour = 0
  const endHour = 24
  const baseDate = startOfDay(new Date())

  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += duration) {
      const d = new Date(baseDate)
      d.setHours(hour)
      d.setMinutes(minute)
      timeRows.push({
        hour,
        minute,
        label: format(d, "h:mm a")
      })
    }
  }

  const getSlotStatus = (date: Date, hour: number, minute: number) => {
    const key = createUtcKey(date, hour, minute, timezone)
    const isMyAvailability = availability[key]
    const availableCount = allParticipants.filter((p) => p.availability[key]).length
    const participants = allParticipants.filter((p) => p.availability[key]).map((p) => p.name)
    return { key, isMyAvailability, availableCount, total: allParticipants.length, participants }
  }

  const handleMouseDown = (key: string, currentVal: boolean) => {
    if (scrollMode) return
    const newValue = !currentVal
    setAvailability({ ...availability, [key]: newValue })
    setIsPainting(true)
    setPaintMode(newValue)
  }

  const handleMouseEnter = (key: string) => {
    if (!isPainting || scrollMode || paintMode === null) return
    setAvailability({ ...availability, [key]: paintMode })
  }

  const handleMouseUp = () => {
    setIsPainting(false)
    setPaintMode(null)
  }

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp)
    return () => document.removeEventListener("mouseup", handleMouseUp)
  }, [])

  const handleSave = () => onSave(availability)

  const getSlotOpacity = (count: number, total: number) => {
    if (total === 0) return 0
    return count / total
  }

  return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div>
            <h3 className="text-lg font-semibold">Mark Your Availability</h3>
            <p className="text-sm text-muted-foreground">
              Times shown in {timezone.replace(/_/g, " ")}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => setScrollMode(!scrollMode)}
                className={cn(
                    "transition-all rounded-full",
                    scrollMode && "bg-accent text-accent-foreground shadow-sm"
                )}
            >
              {scrollMode ? "Scroll Mode" : "Paint Mode"}
            </Button>
            <Button onClick={handleSave} size="sm" className="shadow-sm rounded-full">
              Save Changes
            </Button>
          </div>
        </div>

        <div
            ref={gridRef}
            className={cn(
                "rounded-2xl border border-border/50 overflow-hidden relative shadow-lg flex-1 min-h-0",
                scrollMode ? "cursor-grab active:cursor-grabbing" : "cursor-default"
            )}
        >
          <div className="min-w-max overflow-auto h-full">
            {/* Header Row */}
            <div className="flex sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b shadow-sm">
              <div className="w-24 shrink-0 p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 bg-background/95 backdrop-blur-md sticky left-0 z-30 border-r border-border/40">
                Time
              </div>
              {expandedDates.map((date) => (
                  <div key={date.toString()} className="w-32 md:w-40 shrink-0 px-3 py-3 text-center border-l border-border/30 bg-muted/30 backdrop-blur-sm">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/80">
                      {format(date, "EEE")}
                    </div>
                    <div className="text-lg font-bold mt-0.5">{format(date, "d")}</div>
                    <div className="text-[10px] text-muted-foreground">{format(date, "MMM")}</div>
                  </div>
              ))}
            </div>

            {/* Time Rows */}
            {timeRows.map(({ hour, minute, label }) => (
                <div key={`${hour}-${minute}`} className="flex border-b border-border/40 last:border-0 hover:bg-accent/10 transition-colors">
                  <div className="w-24 shrink-0 py-3 px-3 text-sm font-medium text-right text-muted-foreground/70 sticky left-0 bg-gradient-to-r from-background to-background/95 z-10 border-r border-border/40 flex items-center justify-end">
                    {label}
                  </div>

                  {expandedDates.map((date) => {
                    const { key, isMyAvailability, availableCount, total, participants } = getSlotStatus(date, hour, minute)
                    const opacity = getSlotOpacity(availableCount, total)

                    return (
                        <TooltipProvider key={key}>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <div className="w-32 md:w-40 h-14 shrink-0 border-l border-border/30 flex items-center justify-center p-1">
                                <div
                                    onMouseDown={() => handleMouseDown(key, !!isMyAvailability)}
                                    onMouseEnter={() => handleMouseEnter(key)}
                                    className={cn(
                                        "w-full h-full rounded-xl transition-all duration-200 relative group",
                                        scrollMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                                        !scrollMode && !isMyAvailability && "hover:scale-105 hover:shadow-lg",
                                        isMyAvailability
                                            ? "bg-gradient-to-br from-primary to-primary/90 shadow-md"
                                            : opacity > 0
                                                ? "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/40 dark:to-green-900/30 shadow-sm"
                                                : "bg-muted/40 hover:bg-accent/60"
                                    )}
                                    style={{
                                      opacity: isMyAvailability ? 1 : opacity > 0 ? 0.5 + (opacity * 0.5) : 1,
                                      transformOrigin: "center",
                                    }}
                                >
                                  {/* High availability indicator */}
                                  {!isMyAvailability && availableCount > total * 0.7 && total > 0 && (
                                      <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-green-500 shadow-md ring-2 ring-white dark:ring-gray-800" />
                                  )}

                                  {/* Ripple effect during painting */}
                                  {isPainting && paintMode !== null && (
                                      <div className="absolute inset-0 bg-primary/10 animate-pulse rounded-xl" />
                                  )}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="p-3 max-w-xs rounded-xl bg-popover border-border">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-4">
                                  <p className="font-semibold text-sm text-popover-foreground">
                                    {format(date, "EEE, MMM d")}
                                  </p>
                                  <Badge variant="outline" className="text-xs rounded-full">
                                    {label}
                                  </Badge>
                                </div>
                                {participants.length > 0 ? (
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                                        <p className="text-xs font-medium text-green-600 dark:text-green-400">
                                          {availableCount} of {total} available
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap gap-1.5 mt-2">
                                        {participants.map(name => (
                                            <Badge key={name} variant="secondary" className="text-xs rounded-full">
                                              {name}
                                            </Badge>
                                        ))}
                                      </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                      <Users className="h-3 w-3 shrink-0" />
                                      No availability marked
                                    </p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                    )
                  })}
                </div>
            ))}
          </div>
        </div>

        {/* Legend - Now outside and below the grid */}
        <div className="flex items-center gap-4 lg:gap-6 text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-xl border border-border/40 mt-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-primary to-primary/90 shadow-sm shrink-0" />
            <span className="whitespace-nowrap">Your Availability</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/40 dark:to-green-900/30 shadow-sm shrink-0" />
            <span className="whitespace-nowrap">Others Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-lg bg-muted/40 shrink-0" />
            <span className="whitespace-nowrap">Unavailable</span>
          </div>
        </div>
      </div>
  )
}

"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { format, eachDayOfInterval, startOfDay, addDays, subDays, isBefore, isAfter, isSameDay } from "date-fns"
import { cn } from "@/lib/utils"

// --- Helper: Calculate Visual Date ---
// We need to know "What date is this UTC key in the Target Timezone?"
function getVisualDate(utcKey: string, targetTimezone: string): Date {
  // 1. Parse UTC Key to Timestamp
  const ts = new Date(utcKey).getTime()

  // 2. Format to parts in Target TZ
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

  // Return the "Visual" date (Midnight of that day)
  return new Date(p.year, p.month - 1, p.day)
}

// ... (Previous createUtcKey implementation stays here) ...
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

    // 1. Collect ALL active keys from all participants
    const allKeys = new Set<string>()
    allParticipants.forEach(p => {
      Object.keys(p.availability).forEach(k => {
        if (p.availability[k]) allKeys.add(k)
      })
    })
    // Also include my current unsaved changes
    Object.keys(availability).forEach(k => {
      if (availability[k]) allKeys.add(k)
    })

    // 2. Check each key: "Does this fall outside the current range in MY timezone?"
    allKeys.forEach(key => {
      // Convert UTC Key -> Visual Date in User's Timezone
      const visualDate = getVisualDate(key, timezone)

      // Check boundaries
      if (isBefore(visualDate, start)) {
        start = visualDate // Extend backwards
      }
      if (isAfter(visualDate, end)) {
        end = visualDate // Extend forwards
      }
    })

    return eachDayOfInterval({ start, end })
  }, [dateRange, allParticipants, availability, timezone])

  // Times (0-24)
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

  // ... (Handlers handleMouseDown, etc. remain the same) ...
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
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Mark Your Availability</h3>
            <p className="text-sm text-muted-foreground">
              Times shown in {timezone.replace(/_/g, " ")}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => setScrollMode(!scrollMode)}
                className={scrollMode ? "bg-accent text-accent-foreground" : ""}
            >
              {scrollMode ? <>Scroll Mode</> : <>Paint Mode</>}
            </Button>
            <Button onClick={handleSave} size="sm">
              Save
            </Button>
          </div>
        </div>

        <div
            ref={gridRef}
            className={cn(
                "rounded-md border overflow-auto max-h-[600px] relative",
                scrollMode ? "cursor-grab" : "cursor-default"
            )}
        >
          <div className="min-w-max">
            <div className="flex sticky top-0 z-20 bg-background border-b">
              <div className="w-20 shrink-0 p-2 text-xs font-medium text-muted-foreground bg-background sticky left-0 z-30">
                Time
              </div>
              {/* USE EXPANDED DATES HERE */}
              {expandedDates.map((date) => (
                  <div key={date.toString()} className="w-32 md:w-40 shrink-0 p-2 text-center border-l bg-background">
                    <div className="text-xs font-medium text-muted-foreground">{format(date, "EEE")}</div>
                    <div className="text-sm font-bold">{format(date, "MMM d")}</div>
                  </div>
              ))}
            </div>

            {timeRows.map(({ hour, minute, label }) => (
                <div key={`${hour}-${minute}`} className="flex border-b last:border-0">
                  <div className="w-20 shrink-0 p-2 text-xs text-right text-muted-foreground sticky left-0 bg-background z-10 border-r flex items-center justify-end">
                    {label}
                  </div>

                  {/* USE EXPANDED DATES HERE */}
                  {expandedDates.map((date) => {
                    const { key, isMyAvailability, availableCount, total, participants } = getSlotStatus(date, hour, minute)
                    const opacity = getSlotOpacity(availableCount, total)

                    return (
                        <TooltipProvider key={key}>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <div
                                  onMouseDown={() => handleMouseDown(key, !!isMyAvailability)}
                                  onMouseEnter={() => handleMouseEnter(key)}
                                  className={cn(
                                      "w-32 md:w-40 h-10 md:h-12 shrink-0 border-l transition-all relative",
                                      scrollMode ? "cursor-grab" : "cursor-pointer active:scale-95",
                                      isMyAvailability
                                          ? "bg-primary border-primary shadow-sm z-0"
                                          : "bg-muted/30 border-border hover:border-primary/50"
                                  )}
                                  style={{
                                    backgroundColor: isMyAvailability
                                        ? undefined
                                        : opacity > 0
                                            ? `rgba(34, 197, 94, ${opacity * 0.4})`
                                            : undefined,
                                  }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs">
                                <p className="font-semibold">
                                  {format(date, "MMM d")} at {label}
                                </p>
                                {participants.length > 0 ? (
                                    <>
                                      <p className="text-green-600 mb-1">{availableCount}/{total} available</p>
                                      <p className="text-muted-foreground">{participants.join(", ")}</p>
                                    </>
                                ) : (
                                    <p className="text-muted-foreground">No one available</p>
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
      </div>
  )
}

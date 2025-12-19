"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Toggle } from "@/components/ui/toggle"
import { format, eachDayOfInterval, setHours, setMinutes } from "date-fns"
import { MousePointer2, Hand, Save, Globe } from "lucide-react"
import { cn } from "@/lib/utils"

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
  duration: number
  currentParticipant: Participant
  allParticipants: Participant[]
  onSave: (availability: Record<string, boolean>) => void
  timezone: string // New Prop
}

export function AvailabilityGrid({
                                   dateRange,
                                   duration,
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

  const dates = eachDayOfInterval({ start: dateRange.from, end: dateRange.to })
  const timeSlots: Date[] = []

  const startHour = 9
  const endHour = 17

  // Generate time slots (Using system local time as base reference for "slots")
  // Note: This simplistic generation assumes 9-5 in LOCAL time.
  // Ideally, this should be generated based on the EVENT's timezone if we want to enforce 9-5 in event time.
  // But for now, we generate absolute points in time.
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute = 0; minute < 60; minute += duration) {
      if (hour === endHour && minute > 0) break
      const time = setMinutes(setHours(new Date(), hour), minute)
      timeSlots.push(time)
    }
  }

  const getSlotKey = (date: Date, time: Date) => {
    // Keys must remain consistent regardless of display timezone!
    // We use ISO-like local format for keys to ensure database consistency.
    return `${format(date, "yyyy-MM-dd")}-${format(time, "HH:mm")}`
  }

  const getSlotAvailability = (date: Date, time: Date) => {
    const key = getSlotKey(date, time)
    const availableCount = allParticipants.filter((p) => p.availability[key]).length
    return { count: availableCount, total: allParticipants.length }
  }

  const handleMouseDown = (date: Date, time: Date) => {
    if (scrollMode) return
    const key = getSlotKey(date, time)
    const newValue = !availability[key]
    setAvailability({ ...availability, [key]: newValue })
    setIsPainting(true)
    setPaintMode(newValue)
  }

  const handleMouseEnter = (date: Date, time: Date) => {
    if (!isPainting || scrollMode || paintMode === null) return
    const key = getSlotKey(date, time)
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

  const handleSave = () => {
    onSave(availability)
  }

  const getSlotOpacity = (count: number, total: number) => {
    if (total === 0) return 0
    return count / total
  }

  const getParticipantsForSlot = (date: Date, time: Date) => {
    const key = getSlotKey(date, time)
    return allParticipants.filter((p) => p.availability[key]).map((p) => p.name)
  }

  // Format Helper
  const formatTime = (date: Date) => {
    try {
      return date.toLocaleTimeString([], { timeZone: timezone, hour: 'numeric', minute: '2-digit' })
    } catch (e) {
      return format(date, "h:mm a") // Fallback
    }
  }

  return (
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl">Mark Your Availability</CardTitle>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <Globe className="h-3 w-3" />
              Times shown in {timezone}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Toggle pressed={scrollMode} onPressedChange={setScrollMode}>
              {scrollMode ? <><Hand className="h-4 w-4 mr-2" />Scroll</> : <><MousePointer2 className="h-4 w-4 mr-2" />Paint</>}
            </Toggle>
            <Button onClick={handleSave} size="sm">
              <Save className="h-4 w-4 mr-2" /> Save
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div
              ref={gridRef}
              className={cn(
                  "relative overflow-auto border rounded-lg max-h-[600px] select-none shadow-inner",
                  scrollMode ? "touch-pan-x touch-pan-y" : "touch-none"
              )}
          >
            <div className="min-w-[800px]">
              <div className="grid grid-cols-[100px_repeat(auto-fit,minmax(100px,1fr))] sticky top-0 z-10 bg-background border-b shadow-sm">
                <div className="p-4 font-semibold text-muted-foreground bg-muted/30">Time</div>
                {dates.map((date) => (
                    <div key={date.toString()} className="p-4 text-center border-l bg-muted/30">
                      <div className="font-semibold">{format(date, "EEE")}</div>
                      <div className="text-sm text-muted-foreground">{format(date, "MMM d")}</div>
                    </div>
                ))}
              </div>

              <div className="divide-y">
                {timeSlots.map((time) => (
                    <div key={time.toString()} className="grid grid-cols-[100px_repeat(auto-fit,minmax(100px,1fr))] hover:bg-muted/5 transition-colors">
                      <div className="p-3 text-sm font-medium text-muted-foreground flex items-center justify-center border-r bg-muted/5">
                        {/* Display Time in Preferred Timezone */}
                        {formatTime(time)}
                      </div>
                      {dates.map((date) => {
                        const key = getSlotKey(date, time)
                        const isMyAvailability = availability[key]
                        const { count, total } = getSlotAvailability(date, time)
                        const opacity = getSlotOpacity(count, total)
                        const participants = getParticipantsForSlot(date, time)

                        return (
                            <div key={key} className="p-1 border-l relative">
                              <TooltipProvider>
                                <Tooltip delayDuration={0}>
                                  <TooltipTrigger asChild>
                                    <div
                                        onMouseDown={() => handleMouseDown(date, time)}
                                        onMouseEnter={() => handleMouseEnter(date, time)}
                                        className={cn(
                                            "h-10 md:h-12 min-h-[40px] md:min-h-[48px] rounded-md md:rounded-lg border-2 transition-all relative overflow-hidden",
                                            scrollMode ? "cursor-grab" : "cursor-pointer active:scale-95",
                                            isMyAvailability
                                                ? "bg-primary border-primary shadow-sm"
                                                : "bg-muted/30 border-border hover:border-primary/50",
                                        )}
                                        style={{
                                          backgroundColor: isMyAvailability
                                              ? undefined
                                              : opacity > 0 ? `rgba(34, 197, 94, ${opacity * 0.4})` : undefined,
                                        }}
                                    >
                                      {isMyAvailability && <div className="absolute inset-0 bg-primary/10 animate-pulse" />}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="z-50 text-xs">
                                    {/* Tooltip also needs correct timezone display */}
                                    <p className="font-semibold mb-1">{format(date, "MMM d")} at {formatTime(time)}</p>
                                    {participants.length > 0 ? (
                                        <>
                                          <p className="text-green-600 font-medium mb-1">{count}/{total} available</p>
                                          <p className="text-muted-foreground max-w-[150px] flex flex-wrap gap-1">
                                            {participants.join(", ")}
                                          </p>
                                        </>
                                    ) : <p className="text-muted-foreground">No one available</p>}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                        )
                      })}
                    </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
  )
}

"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Toggle } from "@/components/ui/toggle"
import { format, eachDayOfInterval, setHours, setMinutes } from "date-fns"
import { MousePointer2, Hand, Save } from "lucide-react"
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
}

export function AvailabilityGrid({
  dateRange,
  duration,
  currentParticipant,
  allParticipants,
  onSave,
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

  // Generate time slots
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute = 0; minute < 60; minute += duration) {
      if (hour === endHour && minute > 0) break
      const time = setMinutes(setHours(new Date(), hour), minute)
      timeSlots.push(time)
    }
  }

  const getSlotKey = (date: Date, time: Date) => {
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
    const ratio = count / total
    return ratio
  }

  const getParticipantsForSlot = (date: Date, time: Date) => {
    const key = getSlotKey(date, time)
    return allParticipants.filter((p) => p.availability[key]).map((p) => p.name)
  }

  return (
    <Card>
      <CardHeader className="px-3 md:px-6 pb-3 md:pb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-4">
          <CardTitle className="text-lg md:text-xl lg:text-2xl">Mark Your Availability</CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Toggle
              pressed={scrollMode}
              onPressedChange={setScrollMode}
              variant="outline"
              size="sm"
              className="gap-2 flex-1 sm:flex-initial h-9 md:h-10"
            >
              {scrollMode ? (
                <>
                  <Hand className="w-4 h-4" />
                  <span className="text-xs md:text-sm">Scroll</span>
                </>
              ) : (
                <>
                  <MousePointer2 className="w-4 h-4" />
                  <span className="text-xs md:text-sm">Paint</span>
                </>
              )}
            </Toggle>
            <Button onClick={handleSave} className="gap-2 flex-1 sm:flex-initial h-9 md:h-10 text-xs md:text-sm">
              <Save className="w-4 h-4" />
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 md:px-6">
        <div className="overflow-x-auto -mx-3 md:mx-0 px-3 md:px-0" ref={gridRef}>
          <div className="min-w-[500px] sm:min-w-[600px]">
            {/* Header Row */}
            <div
              className="grid gap-0.5 md:gap-1 mb-0.5 md:mb-1"
              style={{ gridTemplateColumns: `60px repeat(${dates.length}, 1fr)` }}
            >
              <div className="sticky left-0 z-10 bg-card" />
              {dates.map((date) => (
                <div
                  key={date.toISOString()}
                  className="text-center p-1.5 md:p-2 font-semibold text-xs md:text-sm bg-muted rounded-md md:rounded-lg sticky top-0 z-10"
                >
                  <div>{format(date, "EEE")}</div>
                  <div className="text-[10px] md:text-xs text-muted-foreground">{format(date, "MMM d")}</div>
                </div>
              ))}
            </div>

            {/* Time Slots */}
            <TooltipProvider delayDuration={200}>
              {timeSlots.map((time) => (
                <div
                  key={time.toISOString()}
                  className="grid gap-0.5 md:gap-1 mb-0.5 md:mb-1"
                  style={{ gridTemplateColumns: `60px repeat(${dates.length}, 1fr)` }}
                >
                  <div className="text-[10px] md:text-xs text-right pr-1.5 md:pr-2 py-2 font-medium text-muted-foreground sticky left-0 z-10 bg-card">
                    {format(time, "h:mm a")}
                  </div>
                  {dates.map((date) => {
                    const key = getSlotKey(date, time)
                    const isMyAvailability = availability[key]
                    const { count, total } = getSlotAvailability(date, time)
                    const opacity = getSlotOpacity(count, total)
                    const participants = getParticipantsForSlot(date, time)

                    return (
                      <Tooltip key={key}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onMouseDown={() => handleMouseDown(date, time)}
                            onMouseEnter={() => handleMouseEnter(date, time)}
                            onTouchStart={(e) => {
                              e.preventDefault()
                              handleMouseDown(date, time)
                            }}
                            className={cn(
                              "h-10 md:h-12 min-h-[40px] md:min-h-[48px] rounded-md md:rounded-lg border-2 transition-all relative overflow-hidden touch-none",
                              scrollMode ? "cursor-default" : "cursor-pointer active:scale-95",
                              isMyAvailability
                                ? "bg-primary border-primary"
                                : "bg-muted/30 border-border hover:border-primary/50 active:border-primary/50",
                            )}
                            style={{
                              backgroundColor: isMyAvailability ? undefined : `rgba(34, 197, 94, ${opacity * 0.3})`,
                            }}
                          >
                            {isMyAvailability && <div className="absolute inset-0 bg-primary opacity-100" />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs md:text-sm max-w-[200px] md:max-w-none">
                          <div className="space-y-1">
                            <p className="font-semibold">
                              {format(date, "MMM d")} at {format(time, "h:mm a")}
                            </p>
                            {participants.length > 0 ? (
                              <>
                                <p className="text-[10px] md:text-xs text-muted-foreground">
                                  {count}/{total} available
                                </p>
                                <p className="text-[10px] md:text-xs">{participants.join(", ")}</p>
                              </>
                            ) : (
                              <p className="text-[10px] md:text-xs text-muted-foreground">No one available</p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              ))}
            </TooltipProvider>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 md:mt-6 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 md:gap-4 text-xs md:text-sm">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 md:w-6 md:h-6 rounded bg-primary border-2 border-primary flex-shrink-0" />
            <span>Your Availability</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 md:w-6 md:h-6 rounded bg-primary/30 border-2 border-border flex-shrink-0" />
            <span>Group (darker = more people)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 md:w-6 md:h-6 rounded bg-muted/30 border-2 border-border flex-shrink-0" />
            <span>Unavailable</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

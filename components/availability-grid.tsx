"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Toggle } from "@/components/ui/toggle"
import { format, eachDayOfInterval, startOfDay, addMinutes } from "date-fns"
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
  timezone: string
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

  // 1. Generate Visual Grid Structure (Viewer's Local Perspective)
  const { displayDates, displayTimes } = useMemo(() => {
    // Dates
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to })

    // Times (24h)
    const times: Date[] = []
    const baseDate = startOfDay(new Date())
    for (let i = 0; i < 24 * 60; i += duration) {
      times.push(addMinutes(baseDate, i))
    }

    return { displayDates: days, displayTimes: times }
  }, [dateRange, duration])

  // 2. Robust Timezone Conversion
  const getAbsoluteKey = (day: Date, time: Date) => {
    // Visual Components we want
    const y = day.getFullYear()
    const m = day.getMonth()
    const d = day.getDate()
    const h = time.getHours()
    const min = time.getMinutes()

    // 1. Create a "Guess" timestamp (assuming UTC matches Visual)
    let guess = new Date(Date.UTC(y, m, d, h, min))

    // 2. Check what this Guess looks like in the TARGET Timezone
    // (This tells us the offset between UTC and Target at that specific moment)
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', hour12: false
    }).formatToParts(guess)

    // Parse the formatted parts
    const getPart = (type: string) => {
      const p = parts.find(p => p.type === type)
      return p ? parseInt(p.value) : 0
    }

    // Note: formatToParts returns "24" for midnight sometimes in some browsers, handle carefully
    let ph = getPart('hour')
    if (ph === 24) ph = 0

    // Construct the "Visual Time" that our Guess resulted in
    const resultTimeInUTC = Date.UTC(getPart('year'), getPart('month') - 1, getPart('day'), ph, getPart('minute'))
    const wantedTimeInUTC = Date.UTC(y, m, d, h, min)

    // 3. Calculate difference and adjust
    const diff = wantedTimeInUTC - resultTimeInUTC

    // 4. Create correct absolute date
    const correctDate = new Date(guess.getTime() + diff)

    return correctDate.toISOString()
  }

  // 3. Resolve Data for Cell
  const getCellData = (day: Date, time: Date) => {
    const key = getAbsoluteKey(day, time)

    const availableCount = allParticipants.filter((p) => p.availability[key]).length
    return {
      key,
      count: availableCount,
      total: allParticipants.length,
      myVal: availability[key],
      participants: allParticipants.filter((p) => p.availability[key]).map((p) => p.name)
    }
  }

  const handleMouseDown = (key: string, currentVal: boolean) => {
    if (scrollMode) return
    const newValue = !currentVal
    setAvailability(prev => ({ ...prev, [key]: newValue }))
    setIsPainting(true)
    setPaintMode(newValue)
  }

  const handleMouseEnter = (key: string) => {
    if (!isPainting || scrollMode || paintMode === null) return
    setAvailability(prev => ({ ...prev, [key]: paintMode }))
  }

  const handleMouseUp = () => {
    setIsPainting(false)
    setPaintMode(null)
  }

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp)
    return () => document.removeEventListener("mouseup", handleMouseUp)
  }, [])

  return (
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl">Mark Your Availability</CardTitle>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <Globe className="h-3 w-3" />
              Times shown in {timezone || "Local Time"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Toggle pressed={scrollMode} onPressedChange={setScrollMode}>
              {scrollMode ? <><Hand className="h-4 w-4 mr-2" />Scroll</> : <><MousePointer2 className="h-4 w-4 mr-2" />Paint</>}
            </Toggle>
            <Button onClick={() => onSave(availability)} size="sm">
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
              {/* Header Row (Days) */}
              <div className="grid sticky top-0 z-10 bg-background border-b shadow-sm"
                   style={{ gridTemplateColumns: `100px repeat(${displayDates.length}, 1fr)` }}>
                <div className="p-4 font-semibold text-muted-foreground bg-muted/30 border-r text-center">Time</div>
                {displayDates.map((date) => (
                    <div key={date.toString()} className="p-4 text-center border-l bg-muted/30">
                      <div className="font-semibold">{format(date, "EEE")}</div>
                      <div className="text-sm text-muted-foreground">{format(date, "MMM d")}</div>
                    </div>
                ))}
              </div>

              {/* Grid Body (Rows = Times) */}
              <div className="divide-y">
                {displayTimes.map((time, timeIndex) => (
                    <div key={timeIndex}
                         className="grid hover:bg-muted/5 transition-colors"
                         style={{ gridTemplateColumns: `100px repeat(${displayDates.length}, 1fr)` }}>

                      {/* Time Label */}
                      <div className="p-3 text-sm font-medium text-muted-foreground flex items-center justify-center border-r bg-muted/5">
                        {format(time, "h:mm a")}
                      </div>

                      {/* Cells */}
                      {displayDates.map((date) => {
                        const { key, count, total, myVal, participants } = getCellData(date, time)
                        const opacity = total === 0 ? 0 : count / total

                        return (
                            <div key={key} className="p-1 border-l relative h-12">
                              <TooltipProvider>
                                <Tooltip delayDuration={0}>
                                  <TooltipTrigger asChild>
                                    <div
                                        onMouseDown={() => handleMouseDown(key, !!myVal)}
                                        onMouseEnter={() => handleMouseEnter(key)}
                                        className={cn(
                                            "w-full h-full rounded-md border-2 transition-all relative overflow-hidden",
                                            scrollMode ? "cursor-grab" : "cursor-pointer active:scale-95",
                                            myVal
                                                ? "bg-primary border-primary shadow-sm"
                                                : "bg-muted/30 border-border hover:border-primary/50",
                                        )}
                                        style={{
                                          backgroundColor: myVal
                                              ? undefined
                                              : opacity > 0 ? `rgba(34, 197, 94, ${opacity * 0.4})` : undefined,
                                        }}
                                    >
                                      {myVal && <div className="absolute inset-0 bg-primary/10 animate-pulse" />}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="z-50 text-xs">
                                    <p className="font-semibold mb-1">{format(date, "MMM d")} at {format(time, "h:mm a")}</p>
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

          {/* Legend */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-primary border border-primary"></div>
              <span>Your Availability</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500/30 border border-green-500/30"></div>
              <span>Group (darker = more people)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted/30 border border-border"></div>
              <span>Unavailable</span>
            </div>
          </div>
        </CardContent>
      </Card>
  )
}

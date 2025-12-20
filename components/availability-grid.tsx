"use client"

import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { format, eachDayOfInterval, startOfDay, isBefore, isAfter } from "date-fns"
import { cn } from "@/lib/utils"
import { Users, Ban } from "lucide-react"

function getVisualDate(utcKey: string, targetTimezone: string): Date {
    const ts = new Date(utcKey).getTime()
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: targetTimezone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
    })
    const parts = formatter.formatToParts(new Date(ts))
    const p: Record<string, number> = {}
    parts.forEach(({ type, value }) => {
        if (type !== "literal") p[type] = parseInt(value, 10)
    })
    return new Date(p.year, p.month - 1, p.day)
}

function createUtcKey(date: Date, hour: number, minute: number, targetTimezone: string): string {
    const year = date.getFullYear()
    const month = date.getMonth()
    const day = date.getDate()
    const candidateTimestamp = Date.UTC(year, month, day, hour, minute, 0, 0)

    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: targetTimezone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: false,
    })

    const refDate = new Date(candidateTimestamp)
    const parts = formatter.formatToParts(refDate)
    const p: Record<string, number> = {}
    parts.forEach(({ type, value }) => {
        if (type !== "literal") p[type] = parseInt(value, 10)
    })

    const visualDateInTarget = new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute))
    const diff = visualDateInTarget.getTime() - refDate.getTime()
    const desiredUtcTime = candidateTimestamp - diff

    return new Date(desiredUtcTime).toISOString()
}

type DateRange = { from: Date; to: Date }
type Participant = { id: string; name: string; availability: Record<string, boolean> }
type AvailabilityGridProps = {
    dateRange: DateRange
    duration?: number
    currentParticipant: Participant
    allParticipants: Participant[]
    onSave: (availability: Record<string, boolean>) => void
    timezone: string
    disabledSlots: string[]
    isCreator: boolean
    disableMode: boolean
    onToggleDisabled: (slotKey: string) => void
    onToggleDisableMode: () => void
    onResetDisabled: () => void
    resetDisabledLoading: boolean
}

const SlotCell = memo(function SlotCell({
                                            slotKey,
                                            isMyAvailability,
                                            availableCount,
                                            total,
                                            participants,
                                            isPainting,
                                            isDisabled,
                                            disableMode,
                                            isCreator,
                                            disableTooltip,
                                            scrollMode,
                                            onMouseDown,
                                            onMouseEnter,
                                            onTouchStart,
                                        }: {
    slotKey: string
    isMyAvailability: boolean
    availableCount: number
    total: number
    participants: string[]
    isPainting: boolean
    isDisabled: boolean
    disableMode: boolean
    isCreator: boolean
    disableTooltip: boolean
    scrollMode: boolean
    onMouseDown: (e: React.MouseEvent) => void
    onMouseEnter: () => void
    onTouchStart: (e: React.TouchEvent) => void
}) {
    const intensity = total === 0 ? 0 : availableCount / total
    // Purple close to #7a70ff (hsl ~ 245,100%,72), wide lightness ramp for visible contrast
    const lightness = 86 - intensity * 44 // 86% -> 42%
    const gradient = shouldUseGradient(intensity, isDisabled, isMyAvailability, scrollMode)
        ? `linear-gradient(145deg,
        hsl(245 92% ${lightness + 2}%),
        hsl(245 94% ${lightness}%),
        hsl(245 96% ${lightness - 2}%)
      )`
        : undefined
    const shadowAlpha = 0.06 + intensity * 0.38
    const shouldUsePurple = !isDisabled && availableCount > 0 && (scrollMode || !isMyAvailability)

    const cell = (
        <div
            data-slot-key={slotKey}
            className={cn(
                "w-32 md:w-40 shrink-0 h-10 border-l border-border/40 relative cursor-pointer",
                "transition-all duration-150 ease-out rounded-md",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
                "backdrop-blur-sm bg-background/60",
                isDisabled
                    ? "bg-muted/50 cursor-not-allowed line-through text-muted-foreground"
                    : isMyAvailability && !scrollMode
                        ? "bg-gradient-to-br from-primary/90 via-primary/80 to-primary/90 hover:from-primary hover:to-primary/95 text-primary-foreground"
                        : availableCount > 0
                            ? "text-slate-50"
                            : "bg-muted/30 hover:bg-muted/50",
                disableMode && isCreator && "ring-1 ring-primary/60"
            )}
            style={
                shouldUsePurple
                    ? {
                        background: gradient,
                        boxShadow: `inset 0 0 0 1px rgba(0,0,0,${shadowAlpha}), inset 0 12px 32px -14px rgba(0,0,0,${shadowAlpha + 0.14})`,
                    }
                    : undefined
            }
            onMouseDown={onMouseDown}
            onMouseEnter={onMouseEnter}
            onTouchStart={onTouchStart}
        >
            {isDisabled && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-semibold text-muted-foreground">Disabled</span>
                </div>
            )}

            {/* Top-right count in a rounded black translucent chip */}
            {availableCount > 0 && !isDisabled && (
                <div className="absolute top-1 right-1 px-1.5 py-[1px] rounded bg-black/55 text-[9px] font-bold text-white leading-none">
                    +{availableCount}
                </div>
            )}
        </div>
    )

    if (disableTooltip) return cell

    return (
        <Tooltip open={isPainting ? false : undefined}>
            <TooltipTrigger asChild>{cell}</TooltipTrigger>
            <TooltipContent
                side="top"
                className="p-3 max-w-xs rounded-xl border border-border/60 bg-background/95 text-foreground shadow-xl backdrop-blur-sm"
            >
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-foreground">
              {new Date(slotKey).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                  weekday: "short",
                  month: "short",
                  day: "numeric",
              })}
            </span>
                        <Badge
                            variant={isDisabled ? "outline" : isMyAvailability ? "default" : "secondary"}
                            className="text-[10px] font-semibold px-2 py-0.5"
                        >
                            {isDisabled ? "Disabled" : isMyAvailability ? "You're available" : "Not selected"}
                        </Badge>
                    </div>
                    {!isDisabled && participants.length > 0 && (
                        <div className="pt-1 border-t border-border/60">
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/90 mb-1">
                                <Users className="h-3 w-3" />
                                <span className="font-medium">{availableCount} available</span>
                            </div>
                            <div className="text-xs text-foreground/90">
                                {participants.slice(0, 5).join(", ")}
                                {participants.length > 5 && ` +${participants.length - 5} more`}
                            </div>
                        </div>
                    )}
                    {isDisabled && <div className="text-[11px] text-muted-foreground">Blocked by event host</div>}
                </div>
            </TooltipContent>
        </Tooltip>
    )
})

function shouldUseGradient(
    intensity: number,
    isDisabled: boolean,
    isMyAvailability: boolean,
    scrollMode: boolean
): boolean {
    return !isDisabled && intensity > 0 && (scrollMode || !isMyAvailability)
}

export function AvailabilityGrid({
                                     dateRange,
                                     duration = 30,
                                     currentParticipant,
                                     allParticipants,
                                     onSave,
                                     timezone,
                                     disabledSlots,
                                     isCreator,
                                     disableMode,
                                     onToggleDisabled,
                                     onToggleDisableMode,
                                     onResetDisabled,
                                     resetDisabledLoading,
                                 }: AvailabilityGridProps) {
    const [availability, setAvailability] = useState<Record<string, boolean>>(currentParticipant.availability || {})
    const [isPainting, setIsPainting] = useState(false)
    const [paintMode, setPaintMode] = useState<boolean | null>(null)
    const [scrollMode, setScrollMode] = useState(false)
    const [disableDragActive, setDisableDragActive] = useState(false)
    const [disableDragTarget, setDisableDragTarget] = useState<boolean | null>(null)
    const gridRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setAvailability(currentParticipant.availability || {})
    }, [currentParticipant])

    const expandedDates = useMemo(() => {
        let start = dateRange.from
        let end = dateRange.to

        const allKeys = new Set<string>()
        allParticipants.forEach((p) => {
            Object.keys(p.availability).forEach((k) => {
                if (p.availability[k]) allKeys.add(k)
            })
        })
        Object.keys(availability).forEach((k) => {
            if (availability[k]) allKeys.add(k)
        })
        disabledSlots.forEach((k) => allKeys.add(k))

        allKeys.forEach((key) => {
            const visualDate = getVisualDate(key, timezone)
            if (isBefore(visualDate, start)) start = visualDate
            if (isAfter(visualDate, end)) end = visualDate
        })

        return eachDayOfInterval({ start, end })
    }, [dateRange, allParticipants, availability, disabledSlots, timezone])

    const timeRows = useMemo(() => {
        const rows: { hour: number; minute: number; label: string }[] = []
        const baseDate = startOfDay(new Date())

        for (let hour = 0; hour < 24; hour++) {
            for (let minute = 0; minute < 60; minute += duration) {
                const d = new Date(baseDate)
                d.setHours(hour)
                d.setMinutes(minute)
                rows.push({ hour, minute, label: format(d, "h:mm a") })
            }
        }
        return rows
    }, [duration])

    const getSlotStatus = useCallback(
        (date: Date, hour: number, minute: number) => {
            const key = createUtcKey(date, hour, minute, timezone)
            const isMyAvailability = availability[key]
            const isDisabled = disabledSlots.includes(key)
            const availableCount = isDisabled ? 0 : allParticipants.filter((p) => p.availability[key]).length
            const participants = isDisabled ? [] : allParticipants.filter((p) => p.availability[key]).map((p) => p.name)
            return { key, isMyAvailability, availableCount, total: allParticipants.length, participants, isDisabled }
        },
        [availability, allParticipants, timezone, disabledSlots]
    )

    const handleMouseDown = useCallback(
        (e: React.MouseEvent, key: string, currentVal: boolean, isDisabled: boolean) => {
            if (scrollMode) return
            e.preventDefault()

            if (disableMode && isCreator) {
                const target = !isDisabled
                setDisableDragActive(true)
                setDisableDragTarget(target)
                if (isDisabled != target) {
                    onToggleDisabled(key)
                }
                return
            }

            if (isDisabled) return

            const newValue = !currentVal
            setAvailability((prev) => ({ ...prev, [key]: newValue }))
            setIsPainting(true)
            setPaintMode(newValue)
        },
        [scrollMode, disableMode, isCreator, onToggleDisabled]
    )

    const handleMouseEnter = useCallback(
        (key: string, isDisabled: boolean) => {
            if (disableDragActive && disableDragTarget !== null && disableMode && isCreator) {
                if (isDisabled != disableDragTarget) {
                    onToggleDisabled(key)
                }
                return
            }
            if (!isPainting || scrollMode || paintMode === null) return
            if (isDisabled) return
            setAvailability((prev) => ({ ...prev, [key]: paintMode }))
        },
        [disableDragActive, disableDragTarget, disableMode, isCreator, isPainting, scrollMode, paintMode, onToggleDisabled]
    )

    const handleMouseUp = useCallback(() => {
        setIsPainting(false)
        setPaintMode(null)
        setDisableDragActive(false)
        setDisableDragTarget(null)
    }, [])

    const handleTouchStart = useCallback(
        (e: React.TouchEvent, key: string, currentVal: boolean, isDisabled: boolean) => {
            if (scrollMode) return

            if (disableMode && isCreator) {
                const target = !isDisabled
                setDisableDragActive(true)
                setDisableDragTarget(target)
                if (isDisabled != target) {
                    onToggleDisabled(key)
                }
                return
            }

            if (isDisabled) return

            const newValue = !currentVal
            setAvailability((prev) => ({ ...prev, [key]: newValue }))
            setIsPainting(true)
            setPaintMode(newValue)
        },
        [scrollMode, disableMode, isCreator, onToggleDisabled]
    )

    const handleTouchMove = useCallback(
        (e: React.TouchEvent) => {
            if (scrollMode) return
            const touch = e.touches[0]
            const element = document.elementFromPoint(touch.clientX, touch.clientY)
            const slotKey = element?.getAttribute("data-slot-key")
            if (!slotKey) return

            const isDisabled = disabledSlots.includes(slotKey)

            if (disableDragActive && disableDragTarget !== null && disableMode && isCreator) {
                if (isDisabled != disableDragTarget) {
                    onToggleDisabled(slotKey)
                }
                return
            }

            if (!isPainting || paintMode === null) return
            if (isDisabled) return
            setAvailability((prev) => ({ ...prev, [slotKey]: paintMode }))
        },
        [scrollMode, disableDragActive, disableDragTarget, disableMode, isCreator, onToggleDisabled, isPainting, paintMode, disabledSlots]
    )

    const handleTouchEnd = useCallback(() => {
        setIsPainting(false)
        setPaintMode(null)
        setDisableDragActive(false)
        setDisableDragTarget(null)
    }, [])

    useEffect(() => {
        document.addEventListener("mouseup", handleMouseUp)
        document.addEventListener("touchend", handleTouchEnd)
        return () => {
            document.removeEventListener("mouseup", handleMouseUp)
            document.removeEventListener("touchend", handleTouchEnd)
        }
    }, [handleMouseUp, handleTouchEnd])

    const handleSave = () => {
        const cleaned: Record<string, boolean> = {}
        Object.entries(availability).forEach(([k, v]) => {
            if (!disabledSlots.includes(k) && v) cleaned[k] = v
        })
        onSave(cleaned)
    }

    const handleResetAvailability = () => {
        setAvailability({})
        setIsPainting(false)
        setPaintMode(null)
        setDisableDragActive(false)
        setDisableDragTarget(null)
    }

    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between mb-3 shrink-0">
                <div>
                    <h3 className="text-lg font-semibold">Mark Your Availability</h3>
                    <p className="text-sm text-muted-foreground">
                        Times shown in {timezone.replace(/_/g, " ")} {disableMode && "(Host disable mode enabled)"}
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    {isCreator && disableMode && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onResetDisabled}
                            disabled={resetDisabledLoading}
                            className="rounded-full text-xs"
                        >
                            {resetDisabledLoading ? "Resetting..." : "Reset Disabled"}
                        </Button>
                    )}
                    {isCreator && (
                        <Button
                            variant={disableMode ? "secondary" : "outline"}
                            size="sm"
                            onClick={onToggleDisableMode}
                            className={cn("rounded-full text-xs gap-1.5", disableMode && "border-primary/70")}
                        >
                            <Ban className="h-3.5 w-3.5" />
                            {disableMode ? "Exit disable" : "Disable times"}
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetAvailability}
                        className="rounded-full text-xs"
                    >
                        Reset
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setScrollMode(!scrollMode)}
                        className={cn("transition-all rounded-full text-xs", scrollMode && "bg-accent text-accent-foreground shadow-sm")}
                    >
                        {scrollMode ? "Scroll Mode" : "Paint Mode"}
                    </Button>
                    <Button onClick={handleSave} size="sm" className="shadow-sm rounded-full">
                        Save Changes
                    </Button>
                </div>
            </div>

            <TooltipProvider delayDuration={400}>
                <div
                    ref={gridRef}
                    className={cn(
                        "rounded-2xl border border-border/50 overflow-hidden relative shadow-lg flex-1 min-h-0 bg-background",
                        scrollMode ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair",
                        !scrollMode && "select-none"
                    )}
                    style={{
                        userSelect: scrollMode ? "auto" : "none",
                        WebkitUserSelect: scrollMode ? "auto" : "none",
                    }}
                    onTouchMove={handleTouchMove}
                >
                    <div className="min-w-max overflow-auto h-full">
                        <div className="flex sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b shadow-sm">
                            <div className="w-20 md:w-24 shrink-0 p-2 md:p-3 text-[10px] md:text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 bg-background/95 backdrop-blur-md sticky left-0 z-30 border-r border-border/40 flex items-center">
                                Time
                            </div>
                            {expandedDates.map((date) => (
                                <div
                                    key={date.toString()}
                                    className="w-32 md:w-40 shrink-0 px-3 py-3 text-center border-l border-border/30 bg-background/80 backdrop-blur-sm shadow-[0_6px_20px_-18px_rgba(0,0,0,0.45)]"
                                >
                                    <div className="text-[10px] md:text-xs font-semibold text-foreground">{format(date, "EEE")}</div>
                                    <div className="text-xs md:text-sm font-bold text-foreground">{format(date, "MMM d")}</div>
                                </div>
                            ))}
                        </div>

                        {timeRows.map(({ hour, minute, label }) => (
                            <div key={`${hour}-${minute}`} className="flex border-b border-border/30 last:border-0">
                                <div className="w-20 md:w-24 shrink-0 py-3 px-3 text-[10px] md:text-xs font-semibold text-right text-muted-foreground sticky left-0 bg-background/85 backdrop-blur-sm z-10 border-r border-border/40 flex items-center justify-end">
                                    {label}
                                </div>

                                {expandedDates.map((date) => {
                                    const { key, isMyAvailability, availableCount, total, participants, isDisabled } = getSlotStatus(date, hour, minute)

                                    return (
                                        <SlotCell
                                            key={key}
                                            slotKey={key}
                                            isMyAvailability={isMyAvailability}
                                            availableCount={availableCount}
                                            total={total}
                                            participants={participants}
                                            isPainting={isPainting}
                                            isDisabled={isDisabled}
                                            disableMode={disableMode}
                                            isCreator={isCreator}
                                            disableTooltip={disableMode && isCreator}
                                            scrollMode={scrollMode}
                                            onMouseDown={(e) => handleMouseDown(e, key, isMyAvailability, isDisabled)}
                                            onMouseEnter={() => handleMouseEnter(key, isDisabled)}
                                            onTouchStart={(e) => handleTouchStart(e, key, isMyAvailability, isDisabled)}
                                        />
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </TooltipProvider>

            <div className="flex items-center gap-3 md:gap-4 text-[10px] md:text-xs text-muted-foreground bg-muted/30 p-2 md:p-2.5 rounded-xl border border-border/40 mt-3 shrink-0 flex-wrap">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-background/70 backdrop-blur-sm border border-border/40 shadow-sm">
                    <div className="w-3 h-3 md:w-4 md:h-4 rounded bg-primary shadow-sm shrink-0" />
                    <span className="whitespace-nowrap">Your Availability</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-background/70 backdrop-blur-sm border border-border/40 shadow-sm">
                    <div className="w-3 h-3 md:w-4 md:h-4 rounded bg-gradient-to-br from-purple-200 to-purple-300 dark:from-purple-800 dark:to-purple-700 shadow-sm shrink-0" />
                    <span className="whitespace-nowrap">Others Available</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-background/70 backdrop-blur-sm border border-border/40 shadow-sm">
                    <div className="w-3 h-3 md:w-4 md:h-4 rounded bg-muted/60 shrink-0" />
                    <span className="whitespace-nowrap">Unavailable</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-background/70 backdrop-blur-sm border border-border/40 shadow-sm">
                    <div className="w-3 h-3 md:w-4 md:h-4 rounded bg-muted/90 shrink-0" />
                    <span className="whitespace-nowrap">Disabled by host</span>
                </div>
            </div>
        </div>
    )
}
"use client"

import { useEffect, useState, useRef } from "react"

export function useInView(options?: IntersectionObserverInit) {
    const ref = useRef<HTMLDivElement>(null)
    const [isInView, setIsInView] = useState(false)

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsInView(true)
                observer.disconnect() // Trigger once
            }
        }, options)

        if (ref.current) {
            observer.observe(ref.current)
        }

        return () => {
            observer.disconnect()
        }
    }, [options])

    return { ref, isInView }
}

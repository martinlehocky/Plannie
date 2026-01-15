"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { translate, translations, type Language } from "@/lib/translations"

type TranslationContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const TranslationContext = createContext<TranslationContextValue | null>(null)

function applyTemplate(value: string, vars?: Record<string, string | number>) {
  if (!vars) return value
  return Object.entries(vars).reduce((acc, [key, val]) => acc.replace(new RegExp(`{${key}}`, "g"), String(val)), value)
}

function resolveTranslation(language: Language, key: string, fallbackLanguage: Language = "en") {
  const value = translate(language, key) ?? translate(fallbackLanguage, key)
  if (typeof value === "string") return value
  return ""
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en")

  useEffect(() => {
    const stored = typeof window !== "undefined" ? (localStorage.getItem("language") as Language | null) : null
    if (stored === "en" || stored === "de") {
      setLanguage(stored)
      return
    }
    if (typeof navigator !== "undefined") {
      const navLang = navigator.language || navigator.languages?.[0] || ""
      if (navLang.toLowerCase().startsWith("de")) {
        setLanguage("de")
      }
    }
  }, [])

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language
    }
    try {
      localStorage.setItem("language", language)
    } catch {
      // ignore storage errors
    }
  }, [language])

  const value = useMemo<TranslationContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key: string, vars?: Record<string, string | number>) => applyTemplate(resolveTranslation(language, key), vars),
    }),
    [language]
  )

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>
}

export function useTranslations() {
  const ctx = useContext(TranslationContext)
  if (!ctx) {
    throw new Error("useTranslations must be used within a LanguageProvider")
  }
  return ctx
}

export const availableLanguages = Object.keys(translations) as Language[]

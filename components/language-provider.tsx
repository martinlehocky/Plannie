"use client"

import { routing } from "@/src/i18n/routing"

// Re-export locales for backward compatibility
export const availableLanguages = routing.locales

// Simplified LanguageProvider that just passes through children
// since NextIntlClientProvider already handles translations
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

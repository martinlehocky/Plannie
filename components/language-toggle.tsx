"use client"

import { Globe } from "phosphor-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useLocale, useTranslations } from "next-intl"
import { useRouter, usePathname } from "@/src/i18n/navigation"

export function LanguageToggle({ className }: { className?: string }) {
    const t = useTranslations("common")
    const locale = useLocale()
    const router = useRouter()
    const pathname = usePathname()

    const handleLanguageChange = (newLocale: string) => {
        // Store the locale preference in a cookie
        // Note: HttpOnly flag is intentionally not set as this cookie needs to be
        // accessible by client-side JavaScript for the language toggle functionality
        const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : ''
        document.cookie = `NEXT_LOCALE=${encodeURIComponent(newLocale)}; path=/; max-age=31536000; SameSite=Lax${secureFlag}`
        router.replace(pathname, { locale: newLocale as "en" | "de" })
    }

    const selectedLabel =
        locale === "en" ? t("english") :
            locale === "de" ? t("german") :
                locale

    return (
        <Select
            value={locale}
            onValueChange={handleLanguageChange}
        >
            <SelectTrigger className={cn("w-[150px] justify-between", className)}>
                <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <SelectValue placeholder="Language">{selectedLabel}</SelectValue>
                </div>
            </SelectTrigger>

            <SelectContent>
                <SelectItem value="en">{t("english")}</SelectItem>
                <SelectItem value="de">{t("german")}</SelectItem>
            </SelectContent>
        </Select>
    )
}

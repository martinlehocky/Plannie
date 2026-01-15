"use client"

import { Globe } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { availableLanguages, useTranslations } from "./language-provider"

export function LanguageToggle({ className }: { className?: string }) {
    const { language, setLanguage, t } = useTranslations()

    const selectedLabel =
        language === "en" ? t("common.english") :
            language === "de" ? t("common.german") :
                language

    return (
        <Select
            value={language}
            onValueChange={(val) =>
                setLanguage(val as (typeof availableLanguages)[number])
            }
        >
            <SelectTrigger className={cn("w-[150px] justify-between", className)}>
                <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <SelectValue placeholder="Language">{selectedLabel}</SelectValue>
                </div>
            </SelectTrigger>

            <SelectContent>
                <SelectItem value="en">{t("common.english")}</SelectItem>
                <SelectItem value="de">{t("common.german")}</SelectItem>
            </SelectContent>
        </Select>
    )
}

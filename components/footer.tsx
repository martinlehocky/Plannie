"use client"

import Link from "next/link"
import { useTranslations } from "@/components/language-provider"

export function Footer() {
  const { t } = useTranslations()

  return (
    <footer className="border-t bg-background py-8 px-4">
      <div className="container mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
        <div>© {new Date().getFullYear()} {t("common.appName")}</div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 justify-start sm:justify-end">
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            {t("common.privacy")}
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            {t("common.terms")}
          </Link>
          <Link href="/imprint" className="hover:text-foreground transition-colors">
            {t("common.imprint")}
          </Link>
          <Link href="/contact" className="hover:text-foreground transition-colors">
            {t("common.contact")}
          </Link>
        </div>
      </div>
    </footer>
  )
}

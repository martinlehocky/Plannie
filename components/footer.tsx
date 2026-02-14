import Image from "next/image"
import { Link } from "@/src/i18n/navigation"
import { useTranslations } from "next-intl"
import { LanguageToggle } from "@/components/language-toggle"

export function Footer() {
  const tCommon = useTranslations("common")
  const tLanding = useTranslations("landing")

  return (
    <footer className="bg-white dark:bg-slate-950 border-t border-gray-200 dark:border-slate-800 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center overflow-hidden">
              <Image src="/app-icon.png" alt={tCommon("appName")} width={32} height={32} className="w-8 h-8" />
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-white">{tCommon("appName")}</span>
          </div>
          <div className="flex flex-wrap justify-center md:justify-end gap-6 text-sm text-gray-600 dark:text-gray-200">
            <Link className="hover:text-primary transition" href="/privacy">
              {tLanding("footer.privacy")}
            </Link>
            <Link className="hover:text-primary transition" href="/terms">
              {tLanding("footer.terms")}
            </Link>
            <Link className="hover:text-primary transition" href="/imprint">
              {tLanding("footer.imprint")}
            </Link>
            <Link className="hover:text-primary transition" href="/contact">
              {tLanding("footer.contact")}
            </Link>
          </div>
        </div>
        <div className="border-t border-gray-100 dark:border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
          <p>© {new Date().getFullYear()} {tCommon("appName")}. {tLanding("footer.allRights")}</p>
          <div className="flex items-center gap-3">
            <span className="text-gray-700 dark:text-gray-200">{tLanding("footer.language")}</span>
            <LanguageToggle className="w-[160px]" />
          </div>
        </div>
      </div>
    </footer>
  )
}

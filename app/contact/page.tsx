"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"

import { PrivacyTermsNote } from "@/components/privacy-terms-note"
import { useTranslations } from "@/components/language-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export default function ContactPage() {
  const { t } = useTranslations()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // TODO: Wire up backend submission once API, spam protection, and email delivery are available.
  }

  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="container mx-auto max-w-2xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{t("contact.title")}</h1>
          <p className="text-muted-foreground">{t("contact.subtitle")}</p>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t("contact.notice")}</p>
            <p className="mt-1">
              {t("contact.emailFallback")}{" "}
              <Link href="mailto:support@plannie.de" className="text-primary underline underline-offset-4">
                support@plannie.de
              </Link>
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="name">
                {t("contact.nameLabel")}
              </label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("contact.namePlaceholder")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="email">
                {t("contact.emailLabel")}
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("contact.emailPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="message">
                {t("contact.messageLabel")}
              </label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("contact.messagePlaceholder")}
                rows={5}
              />
            </div>

            <Button type="submit" className="w-full" variant="outline" disabled>
              {t("contact.submitLabel")}
            </Button>
            <PrivacyTermsNote />
          </form>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-3">
          <p className="font-semibold">{t("contact.todoTitle")}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t("contact.todoApi")}</li>
            <li>{t("contact.todoSpam")}</li>
            <li>{t("contact.todoRateLimit")}</li>
            <li>{t("contact.todoEmail")}</li>
            <li>{t("contact.todoStorage")}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

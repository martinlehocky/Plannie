"use client"

import { PrivacyTermsNote } from "@/components/privacy-terms-note"
import { useTranslations } from "@/components/language-provider"
import { LEGAL_ENTITY } from "@/lib/legal"

export default function PrivacyPage() {
  const { t } = useTranslations()

  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="container mx-auto max-w-3xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{t("legal.privacyTitle")}</h1>
          <p className="text-muted-foreground">{t("legal.privacyPlaceholder")}</p>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">1. Responsible Party (Controller)</h2>
            <div className="text-muted-foreground">
              <p className="font-medium">{LEGAL_ENTITY.name}</p>
              <p>{LEGAL_ENTITY.address}</p>
              <a className="text-primary underline underline-offset-4" href={`mailto:${LEGAL_ENTITY.email}`}>
                {LEGAL_ENTITY.email}
              </a>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">2. Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Account Data:</span> Username, email address, and password
                (stored as a secure hash).
              </li>
              <li>
                <span className="font-medium text-foreground">Event Data:</span> Event names, dates, timezones, and
                availability times you enter.
              </li>
              <li>
                <span className="font-medium text-foreground">Technical Data:</span> IP address, browser type, and
                timestamps.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>To provide the scheduling service (creating events, saving availability).</li>
              <li>To send system emails (email verification, password resets).</li>
              <li>To protect the site from spam and abuse.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">4. Third-Party Services</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Brevo (formerly Sendinblue):</span> We use Brevo to send
                transactional emails (verification codes, etc.). Your email address is transferred to Brevo for this
                purpose. Brevo publishes its GDPR commitments in its{" "}
                <a
                  className="text-primary underline underline-offset-4"
                  href="https://www.brevo.com/legal/privacypolicy/"
                  rel="noreferrer"
                  target="_blank"
                >
                  privacy policy
                </a>
                .
              </li>
              <li>
                <span className="font-medium text-foreground">Google reCAPTCHA:</span> We use Google reCAPTCHA
                (v2/Enterprise) to check whether data entry is made by a human or an automated program. This analyzes
                behavior (IP address, mouse movements) and sends this data to Google. Legal basis: legitimate interest in
                fraud prevention (Art. 6(1)(f) GDPR). See{" "}
                <a
                  className="text-primary underline underline-offset-4"
                  href="https://policies.google.com/privacy"
                  rel="noreferrer"
                  target="_blank"
                >
                  Google&apos;s Privacy Policy
                </a>
                . You may object to this processing, but reCAPTCHA is required to protect the service from abuse.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">5. Cookies &amp; Local Storage</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Essential Cookies:</span> We use a secure cookie (rt) to
                keep you logged in. This is strictly necessary for the site to function.
              </li>
              <li>
                <span className="font-medium text-foreground">Local Storage:</span> We store your preferredTimezone
                locally on your device to display times correctly.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">6. Your Rights</h2>
            <p className="text-muted-foreground">
              Under the GDPR, you have the right to access, correct, or delete your data. You can delete your account
              permanently at any time in your profile settings, which removes your personal data from our active
              database.
            </p>
          </div>
        </div>

        <PrivacyTermsNote className="text-left" />
      </div>
    </div>
  )
}

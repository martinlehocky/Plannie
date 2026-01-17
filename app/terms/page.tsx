"use client"

import { PrivacyTermsNote } from "@/components/privacy-terms-note"
import { useTranslations } from "@/components/language-provider"
import { LEGAL_ENTITY } from "@/lib/legal"

export default function TermsPage() {
  const { t } = useTranslations()

  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="container mx-auto max-w-3xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{t("legal.termsTitle")}</h1>
          <p className="text-muted-foreground">{t("legal.termsPlaceholder")}</p>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">1. Scope</h2>
            <p className="text-muted-foreground">
              These terms govern your use of Plannie. By creating an account, you agree to these terms.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">2. Services</h2>
            <p className="text-muted-foreground">
              We provide an online tool for scheduling events and coordinating availability. The service is provided
              &quot;as is&quot; and &quot;as available.&quot; We do not guarantee 100% uptime or data persistence. We
              endeavor to take regular backups but cannot guarantee data recovery.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">3. User Accounts</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>You are responsible for keeping your login credentials confidential.</li>
              <li>You are responsible for any content (event names, participant names) you create.</li>
              <li>We reserve the right to terminate accounts that abuse the service or violate laws.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">4. Liability</h2>
            <p className="text-muted-foreground">
              To the fullest extent permitted by law,{" "}
              <span className="font-medium">{LEGAL_ENTITY.name}</span> shall not be liable for any indirect, incidental,
              or consequential damages arising from the use of this service (e.g., missed meetings due to technical
              errors or misuse by others).
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">5. Changes</h2>
            <p className="text-muted-foreground">
              We may update these terms at any time. Continued use of the service constitutes acceptance of the new
              terms.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">6. Governing Law</h2>
            <p className="text-muted-foreground">These terms are governed by the laws of the EU.</p>
          </div>
        </div>

        <PrivacyTermsNote className="text-left" />
      </div>
    </div>
  )
}

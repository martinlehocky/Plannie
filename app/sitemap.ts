import { MetadataRoute } from 'next'
import events from '../events.json'
import { routing } from '@/src/i18n/routing'

const staticRoutes = [
  '',
  'contact',
  'create',
  'dashboard',
  'forgot',
  'imprint',
  'login',
  'privacy',
  'reset-password',
  'settings',
  'terms',
  'verified',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://plannie.de'
  const now = new Date()
  const locales = routing.locales

  // Static pages for all locales
  const staticUrls = staticRoutes.flatMap((route) =>
    locales.map((locale) => {
      // For default locale (en), use base URL without locale prefix
      const url = locale === routing.defaultLocale
        ? `${baseUrl}${route ? '/' + route : ''}`
        : `${baseUrl}/${locale}${route ? '/' + route : ''}`

      return {
        url,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: route === '' ? 1 : 0.8,
        alternates: {
          languages: {
            'en': `${baseUrl}${route ? '/' + route : ''}`,
            'de': `${baseUrl}/de${route ? '/' + route : ''}`,
          },
        },
      }
    })
  )

  // Dynamic event pages from events.json for all locales
  const eventUrls = Object.keys(events).flatMap((id) =>
    locales.map((locale) => {
      const url = locale === routing.defaultLocale
        ? `${baseUrl}/event/${id}`
        : `${baseUrl}/${locale}/event/${id}`

      return {
        url,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.7,
        alternates: {
          languages: {
            'en': `${baseUrl}/event/${id}`,
            'de': `${baseUrl}/de/event/${id}`,
          },
        },
      }
    })
  )

  return [...staticUrls, ...eventUrls]
}
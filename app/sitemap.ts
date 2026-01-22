import { MetadataRoute } from 'next'
import events from '../events.json'

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

  // Static pages
  const staticUrls = staticRoutes.map((route) => ({
    url: `${baseUrl}${route ? '/' + route : ''}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 1,
  }))

  // Dynamic event pages from events.json
  const eventUrls = Object.keys(events).map((id) => ({
    url: `${baseUrl}/event/${id}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  return [...staticUrls, ...eventUrls]
}
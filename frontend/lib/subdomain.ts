/**
 * Shared subdomain-detection logic used by both middleware.ts (which rewrites
 * {slug}.flowmerce.tech requests to /store/{slug}) and the store layout
 * (which needs to know whether the visible browser URL already omits the
 * /store/{slug} prefix, so internal links don't re-add it).
 */

export const MAIN_DOMAIN = 'flowmerce.tech'
const RESERVED_SUBDOMAINS = new Set(['api', 'www'])

/**
 * Returns the store slug if `hostname` is a merchant subdomain
 * (e.g. "jijlk.flowmerce.tech" -> "jijlk"), or null otherwise
 * (main domain, api/www, localhost, custom domain, etc.).
 */
export function getStoreSlugFromHost(hostname: string): string | null {
  const host = hostname.split(':')[0]
  if (!host.endsWith(`.${MAIN_DOMAIN}`)) return null

  const slug = host.slice(0, -(`.${MAIN_DOMAIN}`.length))
  if (!slug || slug.includes('.') || RESERVED_SUBDOMAINS.has(slug)) return null

  return slug
}
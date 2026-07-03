import { NextRequest, NextResponse } from 'next/server'
import { getStoreSlugFromHost } from '@/lib/subdomain'

// Storefront subdomain requests (e.g. jijlk.flowmerce.tech) are rewritten to
// /store/jijlk internally, but the browser URL bar keeps showing the bare
// subdomain path — it never shows /store/jijlk. The x-store-subdomain header
// lets the /store/[slug] layout tell the two cases apart so internal links
// (logo, nav, etc.) don't re-add a /store/{slug} prefix the browser doesn't have.
export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const url = request.nextUrl.clone()

  const slug = getStoreSlugFromHost(hostname)
  if (slug) {
    url.pathname = `/store/${slug}${url.pathname}`
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-store-subdomain', '1')
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
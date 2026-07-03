import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const url = request.nextUrl.clone()

  // استخرجي الـ subdomain
  // مثلاً: lumeri.flowmerce.tech → lumeri
  const mainDomain = 'flowmerce.tech'
  
  if (hostname.endsWith(`.${mainDomain}`)) {
    const slug = hostname.replace(`.${mainDomain}`, '')
    
    // لو مش api أو www
    if (slug !== 'api' && slug !== 'www') {
      // حولي الـ request لـ /store/[slug]
      url.pathname = `/store/${slug}${url.pathname}`
      return NextResponse.rewrite(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
/**
 * AuthPageLayout — shared split-panel layout for all auth pages.
 *
 * Matches the visual design of the existing /login and /signup pages exactly:
 * - Full-screen dark background with an image overlay
 * - Left panel: FlowMerce branding (hidden on mobile)
 * - Right panel: white card containing the form
 */

import Image from 'next/image'

interface AuthPageLayoutProps {
  /** Large heading shown on the left hero panel */
  heroHeading: string
  /** Smaller text below the hero heading */
  heroSubtext: string
  /** Background image path. Defaults to the login background. */
  bgImage?: string
  children: React.ReactNode
}

export default function AuthPageLayout({
  heroHeading,
  heroSubtext,
  bgImage = '/bg-login.png',
  children,
}: AuthPageLayoutProps) {
  return (
    <div className="min-h-screen flex bg-gray-900 relative overflow-hidden">
      {/* Full-bleed background image */}
      <Image
        src={bgImage}
        alt="FlowMerce Background"
        fill
        className="object-cover opacity-40"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900/80 via-gray-900/60 to-transparent" />

      <div className="relative z-10 flex w-full">
        {/* ── Left hero panel (desktop only) ── */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
          <div className="flex flex-col justify-center px-12 text-white">
            <div className="flex items-center gap-3 mb-12">
              <Image
                src="/logo.png"
                alt="FlowMerce Logo"
                width={48}
                height={48}
                className="w-12 h-12"
              />
              <h1 className="text-3xl font-serif">FlowMerce</h1>
            </div>

            <h2 className="text-5xl font-serif leading-tight mb-6 max-w-xl">
              {heroHeading}
            </h2>

            <p className="text-gray-300 text-lg leading-relaxed max-w-md mb-8">
              {heroSubtext}
            </p>

            <div className="flex gap-2">
              <div className="w-12 h-1 bg-white rounded-full" />
              <div className="w-8 h-1 bg-white/40 rounded-full" />
              <div className="w-8 h-1 bg-white/20 rounded-full" />
            </div>
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

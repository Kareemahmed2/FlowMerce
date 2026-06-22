'use client'

import {
  DEFAULT_STOREFRONT_COLORS,
  type StorefrontColors,
} from '@/components/merchant/onboarding/types'
import { contrastLabel, contrastRatio } from '@/lib/design/color-utils'
import { tokens } from '@/lib/design/tokens'
import { useEffect, useRef, useState } from 'react'
import { COLOR_FIELDS, PRESET_THEMES, PREVIEW_PAGES } from './design-constants'
import type { PreviewPage } from './design-constants'
import { DEFAULT_PREVIEW_PRODUCTS } from './design-constants'
import { S } from './design-page-styles'
import { StorePreview } from './StorePreview'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DesignStudioPageProps {
  storeName?: string
  initialColors?: StorefrontColors
  onSave: (colors: StorefrontColors) => Promise<void>
  saving?: boolean
}

type ChatMsg = { role: 'user' | 'assistant'; content: string }
type ColorKey = keyof StorefrontColors
type ParsedPalette = { name: string; colors: Partial<StorefrontColors> }

const SLOT_LABELS: Record<ColorKey, string> = {
  background: 'Background',
  header: 'Header',
  footer: 'Footer',
  accent: 'Accent / CTA',
  text: 'Body Text',
  card: 'Product Card',
}

// Keywords used to guess which slot a standalone hex code (outside a
// ===PALETTE=== block) refers to, from the text surrounding it.
const SLOT_KEYWORDS: Record<ColorKey, string[]> = {
  background: ['background', 'bg', 'page bg'],
  header: ['header', 'nav', 'navbar', 'navigation'],
  footer: ['footer', 'bottom'],
  accent: ['accent', 'button', 'cta', 'highlight', 'primary color', 'brand color', 'call to action'],
  text: ['text', 'body text', 'font color', 'typography'],
  card: ['card', 'product card', 'tile'],
}

function isDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < 128
}

function detectSlot(text: string, hex: string): ColorKey | null {
  const idx = text.toLowerCase().indexOf(hex.toLowerCase())
  if (idx === -1) return null
  const win = text.slice(Math.max(0, idx - 80), idx + 80).toLowerCase()
  for (const [slot, kws] of Object.entries(SLOT_KEYWORDS) as [ColorKey, string[]][]) {
    if (kws.some((k) => win.includes(k))) return slot
  }
  return null
}

/** Parses ===PALETTE: Name=== ... ===END PALETTE=== blocks out of an AI reply. */
function parsePalettes(raw: string): { text: string; palettes: ParsedPalette[] } {
  const palettes: ParsedPalette[] = []
  const cleaned = raw.replace(
    /===PALETTE:\s*(.+?)===\n([\s\S]+?)===END PALETTE===/gi,
    (_, name: string, body: string) => {
      const palette: Partial<StorefrontColors> = {}
      const slotPattern = /(background|header|footer|accent|text|card)\s*:\s*(#[0-9A-Fa-f]{6})/gi
      let m: RegExpExecArray | null
      while ((m = slotPattern.exec(body)) !== null) {
        palette[m[1].toLowerCase() as ColorKey] = m[2]
      }
      if (Object.keys(palette).length > 0) {
        palettes.push({ name: name.trim(), colors: palette })
      }
      return ''
    }
  ).trim()
  return { text: cleaned, palettes }
}

// ── Palette card: a full-template suggestion with an explicit Apply button ────

function PaletteCard({
  palette,
  currentColors,
  onApply,
}: {
  palette: ParsedPalette
  currentColors: StorefrontColors
  onApply: (colors: Partial<StorefrontColors>) => void
}) {
  const keys = Object.keys(palette.colors) as ColorKey[]
  const isApplied = keys.every((key) => palette.colors[key] === currentColors[key])

  return (
    <div style={{
      border: isApplied ? `2px solid ${tokens.color.success}` : `1.5px solid ${tokens.color.border}`,
      borderRadius: tokens.radius.lg, overflow: 'hidden', marginTop: 8, background: tokens.color.surfaceLow,
    }}>
      <div style={{ padding: '8px 10px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 12, flex: 1, color: tokens.color.navy }}>🎨 {palette.name}</span>
        {isApplied && <span style={{ fontSize: 10, color: tokens.color.success, fontWeight: 600 }}>✓ Applied</span>}
      </div>
      <div style={{ display: 'flex', padding: '0 10px 8px', gap: 4, flexWrap: 'wrap' }}>
        {keys.map((key) => (
          <div key={key} title={`${SLOT_LABELS[key]}: ${palette.colors[key]}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, background: palette.colors[key], border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
            <span style={{ fontSize: 9, color: tokens.color.textFaint }}>{SLOT_LABELS[key]}</span>
          </div>
        ))}
      </div>
      {!isApplied && (
        <button
          type="button"
          onClick={() => onApply(palette.colors)}
          style={{
            width: '100%', padding: '8px', background: tokens.color.navy, color: '#fff',
            border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
          }}
        >
          Apply This Template →
        </button>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DesignStudioPage({
  storeName = 'My Store',
  initialColors,
  onSave,
  saving = false,
}: DesignStudioPageProps) {
  const [colors, setColors]         = useState<StorefrontColors>(initialColors ?? DEFAULT_STOREFRONT_COLORS)
  const [savedColors, setSavedColors] = useState<StorefrontColors>(initialColors ?? DEFAULT_STOREFRONT_COLORS)
  const [activePage, setActivePage] = useState<PreviewPage>('Home')
  const [chat, setChat]             = useState<ChatMsg[]>([])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [saved, setSaved]           = useState(false)
  const [toast, setToast]           = useState<string | null>(null)
  const [popover, setPopover]       = useState<{ hex: string; x: number; y: number } | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)

  // Sync colors when parent loads theme from backend
  useEffect(() => {
    if (!initialColors) return
    setColors(initialColors)
    setSavedColors(initialColors)
  }, [initialColors])

  const hasChanges = JSON.stringify(colors) !== JSON.stringify(savedColors)

  const checks = [
    { label: 'Text on Background', a: colors.text,     b: colors.background },
    { label: 'Text on Card',       a: colors.text,     b: colors.card },
    { label: 'CTA on Accent',      a: '#FFFFFF',       b: colors.accent },
    { label: 'Logo on Header',     a: colors.accent,   b: colors.header },
  ] as const

  const systemPrompt = `You are FlowMerce AI Design Assistant, an expert UI/UX color advisor for e-commerce stores.

Store: ${storeName}
Current palette:
  Background: ${colors.background}
  Header:     ${colors.header}
  Footer:     ${colors.footer}
  Accent/CTA: ${colors.accent}
  Body text:  ${colors.text}
  Card:       ${colors.card}

Contrast ratios:
${checks.map((c) => `  ${c.label}: ${contrastRatio(c.a, c.b)}:1 (${contrastLabel(contrastRatio(c.a, c.b)).label})`).join('\n')}

Your role:
- Evaluate the palette for brand fit, WCAG accessibility, and conversion optimization
- Whenever you suggest a new palette (full or partial), output it as a block in EXACTLY
  this format so the merchant can apply it with one click — no exceptions:
===PALETTE: [Name]===
background: #XXXXXX
header: #XXXXXX
footer: #XXXXXX
accent: #XXXXXX
text: #XXXXXX
card: #XXXXXX
===END PALETTE===
  (only include the slots you're actually changing — omit the rest)
- Outside of palette blocks, be concise and actionable (max 120 words per reply)
- When a merchant applies a preset, acknowledge it briefly and offer one improvement tip

LANGUAGE RULE: Detect the language of each user message and always reply in that exact language.`

  const sendMessage = async (message: string) => {
    if (!message.trim() || loading) return
    const userMsg: ChatMsg = { role: 'user', content: message }
    const newChat = [...chat, userMsg]
    setChat(newChat)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: systemPrompt,
          messages: newChat,
        }),
      })
      const data = (await res.json()) as { reply?: string }
      const reply = data.reply ?? 'Could not get a response. Please try again.'
      setChat((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setChat((prev) => [
        ...prev,
        { role: 'assistant', content: 'Connection error. Please check your network.' },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => chatRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 80)
    }
  }

  const quickPrompts = [
    'Evaluate my current palette',
    'Fix my contrast issues',
    'Suggest a dark theme',
    'Is this good for my store type?',
  ]

  const applyPreset = (preset: (typeof PRESET_THEMES)[number]) => {
    setColors(preset.colors)
    setChat((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: `Applied the "${preset.name}" theme. Check the preview — feel free to ask me to tweak any color.`,
      },
    ])
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const applyPalette = (updates: Partial<StorefrontColors>) => {
    setColors((c) => ({ ...c, ...updates }))
    showToast('✓ Template applied!')
  }

  const applyColor = (slot: ColorKey, hex: string) => {
    setColors((c) => ({ ...c, [slot]: hex }))
    showToast(`✓ ${hex} → ${SLOT_LABELS[slot]}`)
    setPopover(null)
  }

  const handleSave = async () => {
    await onSave(colors)
    setSavedColors(colors)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  /** Renders a chat message — palette blocks become apply-able cards, inline hex codes become apply buttons. */
  const renderMessage = (msg: ChatMsg, idx: number) => {
    if (msg.role === 'user') {
      return (
        <div key={idx} style={{ ...S.bubble, ...S.bubbleUser }}>
          <p style={S.bubbleText}>{msg.content}</p>
        </div>
      )
    }

    const { text, palettes } = parsePalettes(msg.content)
    const parts = text.split(/(#[0-9A-Fa-f]{6}\b)/g)

    return (
      <div key={idx} style={{ ...S.bubble, ...S.bubbleAI }}>
        <p style={S.aiTag}>FlowMerce AI</p>
        {text.trim() && (
          <p style={{ ...S.bubbleText, lineHeight: 1.8 }}>
            {parts.map((part, i) => {
              if (!/^#[0-9A-Fa-f]{6}$/i.test(part)) return <span key={i}>{part}</span>
              const slot = detectSlot(text, part)
              const applied = slot ? colors[slot] === part : false
              return (
                <button
                  key={i}
                  type="button"
                  title={applied ? `Already applied` : slot ? `Apply to ${SLOT_LABELS[slot]}` : 'Choose where to apply'}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (applied) return
                    if (slot) { applyColor(slot, part); return }
                    const r = (e.target as HTMLElement).getBoundingClientRect()
                    setPopover({ hex: part, x: r.left, y: r.bottom + 8 })
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: applied ? tokens.color.successSoft : part,
                    color: applied ? tokens.color.success : isDark(part) ? '#fff' : '#111',
                    border: applied ? `2px solid ${tokens.color.success}` : 'none',
                    borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                    cursor: applied ? 'default' : 'pointer', margin: '0 2px',
                    verticalAlign: 'middle', boxShadow: applied ? 'none' : '0 1px 4px rgba(0,0,0,0.15)',
                  }}
                >
                  {applied ? '✓ Applied' : part}
                  {slot && !applied && (
                    <span style={{ background: 'rgba(0,0,0,0.18)', borderRadius: 3, padding: '0 4px', fontSize: 9, fontWeight: 600 }}>
                      → {SLOT_LABELS[slot]}
                    </span>
                  )}
                </button>
              )
            })}
          </p>
        )}
        {palettes.map((p, pi) => (
          <PaletteCard key={pi} palette={p} currentColors={colors} onApply={applyPalette} />
        ))}
      </div>
    )
  }

  return (
    <div style={S.page} onClick={() => setPopover(null)}>
      {toast && (
        <div style={{
          position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
          background: tokens.color.navy, color: '#fff', padding: '10px 20px',
          borderRadius: tokens.radius.md, fontSize: 13, fontWeight: 600, zIndex: 9999,
          boxShadow: tokens.shadow.pop,
        }}>{toast}</div>
      )}
      {popover && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', top: popover.y,
            left: Math.min(popover.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 220),
            zIndex: 9998, background: '#fff', border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.lg, boxShadow: tokens.shadow.pop,
            padding: 12, minWidth: 200,
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 700, color: tokens.color.textFaint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Apply {popover.hex} to:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(Object.keys(SLOT_LABELS) as ColorKey[]).map((key) => (
              <button key={key} type="button" onClick={() => applyColor(key, popover.hex)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', borderRadius: tokens.radius.md, border: `1px solid ${tokens.color.border}`,
                  background: colors[key] === popover.hex ? tokens.color.surfaceHigh : tokens.color.surfaceLow,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', color: tokens.color.navy,
                }}
              >
                <span style={{ width: 14, height: 14, borderRadius: 4, background: colors[key], border: '1px solid #ddd', display: 'inline-block' }} />
                {SLOT_LABELS[key]}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={S.topBar}>
        <div>
          <p style={S.pageTitle}>Storefront Design</p>
          <p style={S.pageSub}>Customize your store colors and get AI feedback in real time</p>
        </div>
        <div style={S.topBarActions}>
          {hasChanges && <span style={S.unsavedBadge}>Unsaved changes</span>}
          <button
            type="button"
            style={{ ...S.saveBtn, opacity: saving ? 0.6 : 1 }}
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div style={S.mainLayout}>
        {/* ── Live preview + contrast checks ── */}
        <div style={S.previewPanel}>
          <div style={S.previewHeader}>
            <p style={S.panelLabel}>Live Preview</p>
            <div style={S.pageTabs}>
              {PREVIEW_PAGES.map((p) => (
                <button
                  key={p}
                  type="button"
                  style={{ ...S.pageTab, ...(activePage === p ? S.pageTabActive : {}) }}
                  onClick={() => setActivePage(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div style={S.previewFrame}>
            <div style={S.previewInner}>
              <StorePreview
                colors={colors}
                activePage={activePage}
                storeName={storeName}
                categories={['Rings', 'Necklaces', 'Earrings']}
                products={DEFAULT_PREVIEW_PRODUCTS}
              />
            </div>
          </div>

          <div style={S.contrastSection}>
            <p style={S.panelLabel}>Accessibility Checks</p>
            <div style={S.contrastGrid}>
              {checks.map((c) => {
                const ratio = contrastRatio(c.a, c.b)
                const cl    = contrastLabel(ratio)
                return (
                  <div key={c.label} style={S.contrastCard}>
                    <div style={S.contrastSwatches}>
                      <div style={{ ...S.contrastSwatch, background: c.b }} />
                      <div style={{ ...S.contrastSwatch, background: c.a, marginLeft: -6 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={S.contrastLabel}>{c.label}</p>
                      <p style={S.contrastRatio}>{ratio}:1</p>
                    </div>
                    <span style={{ ...S.contrastBadge, background: cl.bg, color: cl.color }}>{cl.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Color palette editor ── */}
        <div style={S.colorPanel}>
          <p style={S.panelLabel}>Color Palette</p>

          <div style={S.presetsSection}>
            <p style={S.sectionMiniTitle}>Quick Themes</p>
            <div style={S.presetsGrid}>
              {PRESET_THEMES.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  style={S.presetBtn}
                  onClick={() => applyPreset(preset)}
                >
                  <div style={S.presetSwatches}>
                    {[preset.colors.header, preset.colors.accent, preset.colors.background].map(
                      (c, i) => (
                        <div key={i} style={{ ...S.presetSwatch, background: c }} />
                      )
                    )}
                  </div>
                  <span style={S.presetName}>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={S.colorFields}>
            {(['page', 'brand'] as const).map((section) => (
              <div key={section} style={S.colorSection}>
                <p style={S.sectionMiniTitle}>{section === 'page' ? 'Layout Colors' : 'Brand Colors'}</p>
                {COLOR_FIELDS.filter((f) => f.section === section).map((field) => (
                  <div key={field.key} style={S.colorRow}>
                    <div style={S.colorRowLeft}>
                      <div style={S.colorPickerWrap}>
                        <div style={{ ...S.colorSwatch, background: colors[field.key] }} />
                        <input
                          type="color"
                          value={colors[field.key]}
                          onChange={(e) =>
                            setColors((c) => ({ ...c, [field.key]: e.target.value }))
                          }
                          style={S.colorInput}
                          aria-label={field.label}
                        />
                      </div>
                      <div>
                        <p style={S.colorFieldLabel}>{field.label}</p>
                        <p style={S.colorFieldDesc}>{field.desc}</p>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={colors[field.key]}
                      onChange={(e) => {
                        const v = e.target.value
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) {
                          setColors((c) => ({ ...c, [field.key]: v }))
                        }
                      }}
                      style={S.hexInput}
                      maxLength={7}
                      spellCheck={false}
                      aria-label={`${field.label} hex`}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── AI color advisor chat ── */}
        <div style={S.aiPanel}>
          <div style={S.aiPanelHeader}>
            <div>
              <p style={S.panelLabel}>✦ AI Color Advisor</p>
              <p style={S.aiSub}>Aware of your current colors & contrast</p>
            </div>
          </div>

          <div style={S.quickPrompts}>
            {quickPrompts.map((q) => (
              <button
                key={q}
                type="button"
                style={S.quickPromptBtn}
                onClick={() => void sendMessage(q)}
              >
                {q}
              </button>
            ))}
          </div>

          <div ref={chatRef} style={S.chatMessages}>
            {chat.length === 0 && (
              <div style={S.chatEmpty}>
                <span style={{ fontSize: 28, opacity: 0.15 }}>✦</span>
                <p style={S.chatEmptyText}>
                  Ask me anything about your store&apos;s colors, accessibility, or brand strategy.
                </p>
              </div>
            )}
            {chat.map((m, i) => renderMessage(m, i))}
            {loading && (
              <div style={{ ...S.bubble, ...S.bubbleAI }}>
                <p style={S.aiTag}>FlowMerce AI</p>
                <p style={{ ...S.bubbleText, opacity: 0.5 }}>Analyzing your palette...</p>
              </div>
            )}
          </div>

          <div style={S.chatInputWrap}>
            <textarea
              style={S.chatInput}
              placeholder="Ask about colors, accessibility, brand fit..."
              value={input}
              rows={2}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void sendMessage(input)
                }
              }}
              disabled={loading}
            />
            <button
              type="button"
              style={{ ...S.sendBtn, ...(loading ? S.sendBtnDisabled : {}) }}
              onClick={() => void sendMessage(input)}
              disabled={loading}
              aria-label="Send message"
            >
              ▷
            </button>
          </div>
          <p style={S.chatHint}>Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )
}

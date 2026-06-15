'use client'

import {
  DEFAULT_STOREFRONT_COLORS,
  type StorefrontColors,
} from '@/components/merchant/onboarding/types'
import { contrastLabel, contrastRatio } from '@/lib/design/color-utils'
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
- Give specific hex code suggestions formatted as: Field → #HEXCODE
- Be concise and actionable (max 120 words per reply)
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

  const handleSave = async () => {
    await onSave(colors)
    setSavedColors(colors)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={S.page}>
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
            {chat.map((m, i) => (
              <div
                key={i}
                style={{ ...S.bubble, ...(m.role === 'user' ? S.bubbleUser : S.bubbleAI) }}
              >
                {m.role === 'assistant' && <p style={S.aiTag}>FlowMerce AI</p>}
                <p style={S.bubbleText}>{m.content}</p>
              </div>
            ))}
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

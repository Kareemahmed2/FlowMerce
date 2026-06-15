'use client'

import { useRef, useState } from 'react'
import type { BrandData, CatalogCategory, ThemeColors } from './types'
import { styles } from './wizard-styles'

type ChatMsg = { role: 'user' | 'assistant'; content: string }
type ColorSlot = keyof ThemeColors

const COLOR_SLOTS: { key: ColorSlot; label: string }[] = [
  { key: 'background', label: 'Background' },
  { key: 'header',     label: 'Header'     },
  { key: 'footer',     label: 'Footer'     },
  { key: 'accent',     label: 'Accent'     },
  { key: 'text',       label: 'Text'       },
  { key: 'card',       label: 'Card'       },
]

type ParsedPalette = {
  name: string
  colors: Partial<ThemeColors>
}

type Props = {
  brandData: BrandData
  categories: CatalogCategory[]
  colors: ThemeColors
  onSuggestionsReceived: (text: string) => void
  onColorsChange?: (colors: ThemeColors) => void
}

/* ─── helpers ─────────────────────────────────────────────────── */

function isDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < 128
}

/**
 * Parse ===PALETTE: Name=== ... ===END PALETTE=== blocks from AI text.
 * Returns array of { name, colors } and the cleaned text (blocks removed).
 */
function parsePalettes(raw: string): { text: string; palettes: ParsedPalette[] } {
  const palettes: ParsedPalette[] = []
  const cleaned = raw.replace(
    /===PALETTE:\s*(.+?)===\n([\s\S]+?)===END PALETTE===/gi,
    (_, name: string, body: string) => {
      const palette: Partial<ThemeColors> = {}
      const slotPattern = /(background|header|footer|accent|text|card)\s*:\s*(#[0-9A-Fa-f]{6})/gi
      let m: RegExpExecArray | null
      while ((m = slotPattern.exec(body)) !== null) {
        const slot = m[1].toLowerCase() as ColorSlot
        palette[slot] = m[2]
      }
      if (Object.keys(palette).length >= 3) {
        palettes.push({ name: name.trim(), colors: palette })
      }
      return '' // remove block from display text
    }
  ).trim()
  return { text: cleaned, palettes }
}

/**
 * Detect slot for a hex code by looking at surrounding words.
 */
function detectSlot(text: string, hex: string): ColorSlot | null {
  const idx = text.toLowerCase().indexOf(hex.toLowerCase())
  if (idx === -1) return null
  const win = text.slice(Math.max(0, idx - 80), idx + 80).toLowerCase()
  const map: Record<ColorSlot, string[]> = {
    background: ['background', 'bg', 'page bg'],
    header:     ['header', 'nav', 'navbar', 'navigation'],
    footer:     ['footer', 'bottom'],
    accent:     ['accent', 'button', 'cta', 'highlight', 'primary color', 'brand color', 'call to action'],
    text:       ['text', 'body text', 'font color', 'typography'],
    card:       ['card', 'product card', 'tile'],
  }
  for (const [slot, kws] of Object.entries(map) as [ColorSlot, string[]][]) {
    if (kws.some((k) => win.includes(k))) return slot
  }
  return null
}

/* ─── Mini Store Preview ──────────────────────────────────────── */

function MiniPreview({ colors, brandName }: { colors: ThemeColors; brandName: string }) {
  const bg   = colors.background || '#FFFFFF'
  const hdr  = colors.header     || '#1A1A1A'
  const ftr  = colors.footer     || '#1A1A1A'
  const acc  = colors.accent     || '#E94560'
  const txt  = colors.text       || '#1A1A1A'
  const crd  = colors.card       || '#FFFFFF'

  return (
    <div style={{
      width: '100%',
      borderRadius: 12,
      overflow: 'hidden',
      border: '1.5px solid #e5e0d8',
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      fontSize: 10,
      userSelect: 'none',
    }}>
      {/* Header */}
      <div style={{ background: hdr, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: isDark(hdr) ? '#fff' : '#111', fontWeight: 700, fontSize: 11, letterSpacing: '0.03em' }}>
          {brandName || 'Your Store'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Home', 'Shop', 'Cart'].map((l) => (
            <span key={l} style={{ color: isDark(hdr) ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)', fontSize: 9 }}>{l}</span>
          ))}
        </div>
      </div>

      {/* Hero banner */}
      <div style={{ background: bg, padding: '14px 12px 8px', borderBottom: `1px solid ${crd === bg ? '#e5e0d8' : 'transparent'}` }}>
        <div style={{ color: txt, fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
          Welcome to {brandName || 'Our Store'}
        </div>
        <div style={{ color: txt, opacity: 0.6, fontSize: 9, marginBottom: 10 }}>
          Discover our latest collection
        </div>
        <div style={{ display: 'inline-block', background: acc, color: isDark(acc) ? '#fff' : '#111', borderRadius: 6, padding: '5px 12px', fontSize: 9, fontWeight: 700 }}>
          Shop Now
        </div>
      </div>

      {/* Product cards row */}
      <div style={{ background: bg, padding: '10px 12px', display: 'flex', gap: 8 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            flex: 1, background: crd, borderRadius: 8,
            border: `1px solid ${isDark(bg) ? 'rgba(255,255,255,0.1)' : '#ede8df'}`,
            overflow: 'hidden',
          }}>
            {/* Product image placeholder */}
            <div style={{
              height: 44, background: `linear-gradient(135deg, ${acc}22, ${hdr}22)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: 20, height: 20, borderRadius: 4, background: acc, opacity: 0.4 }} />
            </div>
            <div style={{ padding: '5px 6px' }}>
              <div style={{ height: 6, background: txt, opacity: 0.15, borderRadius: 3, marginBottom: 4 }} />
              <div style={{ height: 5, width: '60%', background: txt, opacity: 0.1, borderRadius: 3, marginBottom: 6 }} />
              <div style={{ background: acc, borderRadius: 4, padding: '2px 0', textAlign: 'center', color: isDark(acc) ? '#fff' : '#111', fontSize: 8, fontWeight: 700 }}>
                Buy
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ background: ftr, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: isDark(ftr) ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)', fontSize: 8 }}>
          © {brandName || 'Store'}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {['About', 'Contact'].map((l) => (
            <span key={l} style={{ color: isDark(ftr) ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)', fontSize: 8 }}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Palette Card ────────────────────────────────────────────── */

function PaletteCard({
  palette,
  currentColors,
  onApply,
}: {
  palette: ParsedPalette
  currentColors: ThemeColors
  onApply: (colors: ThemeColors) => void
}) {
  const merged: ThemeColors = { ...currentColors, ...palette.colors }
  const isApplied = COLOR_SLOTS.every(
    ({ key }) => !palette.colors[key] || palette.colors[key] === currentColors[key]
  )

  return (
    <div style={{
      border: isApplied ? '2px solid #22c55e' : '1.5px solid #e5e0d8',
      borderRadius: 12,
      overflow: 'hidden',
      marginTop: 10,
      background: '#faf8f5',
    }}>
      {/* Palette name + swatches */}
      <div style={{ padding: '10px 12px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 13, flex: 1, color: '#1a1a1a' }}>
          🎨 {palette.name}
        </span>
        {isApplied && <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>✓ Applied</span>}
      </div>

      {/* Color swatches */}
      <div style={{ display: 'flex', padding: '0 12px 8px', gap: 5, flexWrap: 'wrap' }}>
        {COLOR_SLOTS.map(({ key, label }) => {
          const hex = palette.colors[key]
          if (!hex) return null
          return (
            <div key={key} title={`${label}: ${hex}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, background: hex, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: '#888' }}>{label}</span>
            </div>
          )
        })}
      </div>

      {/* Mini preview of this palette */}
      <div style={{ padding: '0 12px 10px' }}>
        <MiniPreview colors={merged} brandName="" />
      </div>

      {/* Apply button */}
      {!isApplied && (
        <button
          type="button"
          onClick={() => onApply(merged)}
          style={{
            width: '100%', padding: '10px', background: '#1a1a1a', color: '#fff',
            border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          Apply Full Palette →
        </button>
      )}
    </div>
  )
}

/* ─── Main Component ──────────────────────────────────────────── */

export function StepAI({ brandData, categories, colors, onSuggestionsReceived, onColorsChange }: Props) {
  const [loading, setLoading] = useState(false)
  const [chat, setChat]   = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const chatRef           = useRef<HTMLDivElement>(null)
  const [popover, setPopover] = useState<{ hex: string; x: number; y: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const categoryTypes  = categories.map((c) => c.name).join(', ') || 'General products'
  const totalProducts  = categories.reduce((sum, c) => sum + c.products.length, 0)
  const catalogSummary = categories.length === 0
    ? 'No products added yet.'
    : categories.map((cat) => {
        const list = cat.products.length === 0 ? '  (no products yet)'
          : cat.products.map((p) => `  - ${p.name}${p.price ? ` ($${p.price})` : ''}${p.description ? `: ${p.description.slice(0, 80)}` : ''}`).join('\n')
        return `Category: ${cat.name}\n${list}`
      }).join('\n\n')

  const textLine = colors.text ? `\n  • text: ${colors.text}` : ''
  const cardLine = colors.card ? `\n  • card: ${colors.card}` : ''

  const systemPrompt = `You are a senior e-commerce UI designer. Your job: give ONE decisive recommendation per response. Never hedge. Never say "it depends." You are the expert — make the call.

STORE:
Brand: ${brandData.name || 'Unnamed Store'}
Niche: ${categoryTypes}
Products (${totalProducts}): ${catalogSummary}
Current palette — bg:${colors.background} header:${colors.header} footer:${colors.footer} accent:${colors.accent}${colors.text ? ` text:${colors.text}` : ''}${colors.card ? ` card:${colors.card}` : ''}

NICHE PALETTE LIBRARY (battle-tested):
• Rings/Jewelry/Luxury → bg:#0D1B2A header:#0A1628 footer:#050E1A accent:#C9A84C text:#F0E6D3 card:#152238
• Fashion → bg:#F9F6F2 header:#1A1A1A footer:#111111 accent:#D4845A text:#2C2C2C card:#FFFFFF
• Electronics → bg:#F8F9FA header:#1C2B3A footer:#0F1923 accent:#0066FF text:#1C2B3A card:#FFFFFF
• Health/Organic → bg:#FAFAF5 header:#2D5016 footer:#1E3A0F accent:#8FAF7E text:#2C3E1F card:#F0F5EB
• Beauty/Cosmetics → bg:#FDF6F0 header:#2C1810 footer:#1A0F08 accent:#C97B5A text:#2C1810 card:#FFF5F0
• Sports → bg:#0A0A0A header:#111111 footer:#000000 accent:#00FF87 text:#FFFFFF card:#1A1A1A
• Home Decor → bg:#F5EFE6 header:#3D2B1F footer:#2A1E15 accent:#C1693A text:#3D2B1F card:#EDE5D8
• Food/Bakery → bg:#FFF8F0 header:#3D1C02 footer:#2A1200 accent:#E07A5F text:#3D1C02 card:#FFF0E5

PALETTE FORMAT — REQUIRED for every palette you suggest:
===PALETTE: [Name]===
background: #XXXXXX
header: #XXXXXX
footer: #XXXXXX
accent: #XXXXXX
text: #XXXXXX
card: #XXXXXX
===END PALETTE===

RULES:
1. "Give me the best template / best palette / أفضل تمبليت / اديني الأفضل" → output EXACTLY ONE palette block. State it is the winner. Done.
2. "Analyze / audit / score" → score /10 in 2 sentences + ONE primary palette + ONE alternative. Total ≤ 180 words.
3. Every palette you suggest MUST be in the block format above — no exceptions.
4. Reference the actual niche (${categoryTypes}) in your reasoning, not generic luxury talk.
5. Max 180 words per response. No bullet lists longer than 4 items. No repeating what was said before.`

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const applyColor = (slot: ColorSlot, hex: string) => {
    if (!onColorsChange) return
    onColorsChange({ ...colors, [slot]: hex })
    showToast(`✓ ${hex} → ${slot}`)
    setPopover(null)
  }

  const applyPalette = (newColors: ThemeColors) => {
    if (!onColorsChange) return
    onColorsChange(newColors)
    showToast('✓ Full palette applied!')
  }

  const sendMessage = async (message: string) => {
    if (!message.trim()) return
    const userMsg: ChatMsg = { role: 'user', content: message }
    const newChat = [...chat, userMsg]
    setChat(newChat)
    setInput('')
    setLoading(true)
    setPopover(null)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: systemPrompt,
          messages: newChat.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = (await res.json()) as { reply?: string }
      const reply = data.reply ?? 'Sorry, I could not process that.'
      setChat((prev) => [...prev, { role: 'assistant', content: reply }])
      onSuggestionsReceived(reply)
    } catch {
      setChat((prev) => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }])
    } finally {
      setLoading(false)
      setTimeout(() => chatRef.current?.scrollTo({ top: 9999, behavior: 'smooth' }), 100)
    }
  }

  const autoAnalyze = () => {
    const productNames = categories.flatMap((c) => c.products.map((p) => p.name)).slice(0, 6).join(', ')
    const productContext = productNames ? ` Products: ${productNames}.` : ''
    void sendMessage(
      `Audit "${brandData.name || 'my store'}" — niche: ${categoryTypes}.${productContext} ` +
      `Score current palette /10 (2 sentences max). ` +
      `Then give me your TOP recommendation as the primary palette, and ONE alternative. ` +
      `For each: name it, output the full palette block, explain in 1 sentence why it converts ${categoryTypes} buyers.`
    )
  }

  const bestTemplate = () => {
    void sendMessage(
      `Give me the single BEST complete template for selling ${categoryTypes}. ` +
      `One palette only — your top pick. Output the palette block and tell me in 2 sentences why this specific combination is the winner for ${categoryTypes}.`
    )
  }

  /* render AI message — palette blocks become cards, hex codes become buttons */
  const renderMessage = (msg: ChatMsg, idx: number) => {
    if (msg.role === 'user') {
      return (
        <div key={idx} style={{ ...styles.chatBubble, ...styles.chatBubbleUser }}>
          <p style={styles.chatText}>{msg.content}</p>
        </div>
      )
    }

    const { text, palettes } = parsePalettes(msg.content)
    const parts = text.split(/(#[0-9A-Fa-f]{6}\b)/g)

    return (
      <div key={idx} style={{ ...styles.chatBubble, ...styles.chatBubbleAI }}>
        <span style={styles.aiLabel}>AI</span>

        {/* Text with inline hex swatches */}
        {text.trim() && (
          <p style={{ ...styles.chatText, lineHeight: 1.8 }}>
            {parts.map((part, i) => {
              if (!/^#[0-9A-Fa-f]{6}$/i.test(part)) return <span key={i}>{part}</span>
              const slot = detectSlot(text, part)
              const slotLabel = slot ? COLOR_SLOTS.find((s) => s.key === slot)?.label : null
              const applied = slot && colors[slot] === part

              return (
                <button
                  key={i}
                  type="button"
                  title={applied ? `Already ${slotLabel}` : slot ? `Apply to ${slotLabel}` : 'Choose slot'}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (applied) return
                    if (slot) { applyColor(slot, part); return }
                    const r = (e.target as HTMLElement).getBoundingClientRect()
                    setPopover({ hex: part, x: r.left, y: r.bottom + 8 })
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: applied ? '#e8f5e9' : part,
                    color: applied ? '#2e7d32' : isDark(part) ? '#fff' : '#111',
                    border: applied ? '2px solid #4caf50' : 'none',
                    borderRadius: 7, padding: '2px 9px', fontSize: 11, fontWeight: 700,
                    cursor: applied ? 'default' : 'pointer', margin: '0 2px',
                    verticalAlign: 'middle', boxShadow: applied ? 'none' : '0 1px 4px rgba(0,0,0,0.15)',
                    transition: 'transform 0.1s',
                  }}
                  onMouseEnter={(e) => { if (!applied) (e.currentTarget as HTMLElement).style.transform = 'scale(1.07)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
                >
                  {applied ? '✓' : <span style={{ width: 8, height: 8, borderRadius: '50%', background: isDark(part) ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)', display: 'inline-block' }} />}
                  {applied ? ' Applied' : part}
                  {slotLabel && !applied && (
                    <span style={{ background: 'rgba(0,0,0,0.18)', borderRadius: 3, padding: '0 4px', fontSize: 9, fontWeight: 600 }}>
                      → {slotLabel}
                    </span>
                  )}
                  {!slot && !applied && <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>}
                </button>
              )
            })}
          </p>
        )}

        {/* Palette cards */}
        {palettes.map((p, pi) => (
          <PaletteCard key={pi} palette={p} currentColors={colors} onApply={applyPalette} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }} onClick={() => setPopover(null)}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a1a', color: '#fff', padding: '10px 20px',
          borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>{toast}</div>
      )}

      {/* Slot picker popover */}
      {popover && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', top: popover.y,
            left: Math.min(popover.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 220),
            zIndex: 9998, background: '#fff', border: '1px solid #e5e0d8',
            borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            padding: 12, minWidth: 200,
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Apply {popover.hex} to:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {COLOR_SLOTS.map(({ key, label }) => (
              <button key={key} type="button" onClick={() => applyColor(key, popover.hex)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e0d8',
                  background: colors[key] === popover.hex ? '#f0ece4' : '#faf8f5',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#333',
                }}
              >
                <span style={{ width: 14, height: 14, borderRadius: 4, background: colors[key] ?? '#fff', border: '1px solid #ddd', display: 'inline-block' }} />
                {label}
                {colors[key] === popover.hex && <span style={{ color: '#22c55e' }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3-column layout — fills full available height */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 230px', gap: 0, height: '100%', minHeight: 0, flex: 1 }}>

        {/* ── Left: Context panel ── */}
        <div style={{ ...styles.aiContextPanel, borderRight: '1px solid #ede8df', borderRadius: 0, overflowY: 'auto' }}>
          <p style={styles.panelTitle}>Store Context</p>
          <div style={styles.contextItem}>
            <span style={styles.contextLabel}>Brand</span>
            <span style={styles.contextValue}>{brandData.name || '—'}</span>
          </div>
          <div style={styles.contextItem}>
            <span style={styles.contextLabel}>Niche</span>
            <span style={styles.contextValue}>{categoryTypes}</span>
          </div>
          <div style={styles.contextItem}>
            <span style={styles.contextLabel}>Products</span>
            <span style={styles.contextValue}>{totalProducts}</span>
          </div>
          {categories.map((cat) => cat.products.length > 0 && (
            <div key={cat.id} style={{ marginTop: 4, paddingLeft: 8, borderLeft: '2px solid #f0ece4' }}>
              <span style={{ ...styles.contextLabel, fontSize: 10 }}>{cat.name}</span>
              {cat.products.map((p) => (
                <div key={p.id} style={{ fontSize: 10, color: '#666', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                  {p.name}{p.price ? ` $${p.price}` : ''}
                </div>
              ))}
            </div>
          ))}

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button type="button"
              style={{ ...styles.primaryBtn, width: '100%', fontSize: 12 }}
              onClick={autoAnalyze}
            >
              ✦ Auto Analyze
            </button>
            <button type="button"
              onClick={bestTemplate}
              style={{
                width: '100%', padding: '8px 0',
                background: 'linear-gradient(135deg, #C9A84C, #E8C96A)',
                color: '#0D1B2A', border: 'none', borderRadius: 8,
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                letterSpacing: '0.02em',
              }}
            >
              ★ Best Template
            </button>
          </div>

          {/* Palette slots */}
          <div style={{ marginTop: 16 }}>
            <p style={{ ...styles.contextLabel, marginBottom: 6 }}>Palette</p>
            {COLOR_SLOTS.map(({ key, label }) => colors[key] && (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, background: colors[key], border: '1px solid #ddd', flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: '#666', flex: 1 }}>{label}</span>
                <span style={{ fontSize: 9, color: '#bbb' }}>{colors[key]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Middle: Chat ── */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #ede8df' }}>
          <div ref={chatRef} style={{ ...styles.chatMessages, flex: 1, overflowY: 'auto' }}>
            {chat.length === 0 && (
              <div style={styles.chatEmpty}>
                <span style={{ fontSize: 32, opacity: 0.15 }}>✦</span>
                <p style={styles.emptyHint}>
                  Click "Auto Analyze" for a full palette audit, or ask anything about your colors
                </p>
              </div>
            )}
            {chat.map((m, i) => renderMessage(m, i))}
            {loading && (
              <div style={{ ...styles.chatBubble, ...styles.chatBubbleAI }}>
                <span style={styles.aiLabel}>AI</span>
                <p style={styles.chatText}>Analyzing your store…</p>
              </div>
            )}
          </div>
          {/* Quick action chips */}
          {chat.length === 0 && !loading && (
            <div style={{ padding: '8px 12px', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid #f0ece4' }}>
              {[
                { label: '★ Best Template', fn: bestTemplate },
                { label: '✦ Full Audit', fn: autoAnalyze },
                { label: '🎨 Dark Luxury', fn: () => sendMessage(`Give me the best dark luxury palette for selling ${categoryTypes}. One palette block only.`) },
                { label: '☀ Clean Minimal', fn: () => sendMessage(`Give me the best clean minimal light palette for selling ${categoryTypes}. One palette block only.`) },
              ].map(({ label, fn }) => (
                <button
                  key={label}
                  type="button"
                  onClick={fn}
                  style={{
                    padding: '5px 10px', borderRadius: 20,
                    border: '1px solid #e5e0d8', background: '#faf8f5',
                    fontSize: 11, fontWeight: 600, color: '#555', cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div style={{ ...styles.chatInputRow, borderTop: '1px solid #ede8df' }}>
            <input
              style={{ ...styles.input, marginBottom: 0, flex: 1 }}
              placeholder="Ask for a palette, score, or improvement…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void sendMessage(input)}
              disabled={loading}
            />
            <button type="button" style={styles.sendBtn} onClick={() => void sendMessage(input)} disabled={loading}>▷</button>
          </div>
        </div>

        {/* ── Right: Live preview ── */}
        <div style={{ padding: '16px 12px', overflowY: 'auto', background: '#faf8f5' }}>
          <p style={{ ...styles.panelTitle, marginBottom: 12 }}>Live Preview</p>
          <MiniPreview colors={colors} brandName={brandData.name} />
          <p style={{ fontSize: 10, color: '#bbb', textAlign: 'center', marginTop: 8 }}>
            Updates as you apply colors
          </p>

          {/* Color slots quick edit */}
          <div style={{ marginTop: 16 }}>
            <p style={{ ...styles.contextLabel, marginBottom: 8 }}>Quick Slots</p>
            {COLOR_SLOTS.map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <input
                  type="color"
                  value={colors[key] || '#ffffff'}
                  onChange={(e) => onColorsChange?.({ ...colors, [key]: e.target.value })}
                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer', padding: 0 }}
                  title={`Edit ${label}`}
                />
                <span style={{ fontSize: 11, color: '#555', flex: 1 }}>{label}</span>
                <span style={{ fontSize: 9, color: '#bbb' }}>{colors[key] || '—'}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

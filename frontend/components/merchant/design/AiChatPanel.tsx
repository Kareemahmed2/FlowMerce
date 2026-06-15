'use client'

import { useRef, useState } from 'react'

// ── Context passed by the host page ──────────────────────────────────────────

export interface AiStoreContext {
  storeName?: string
  status?: string
  themeColors?: {
    background?: string
    header?: string
    footer?: string
    accent?: string
    text?: string
    card?: string
  }
  pages?: Array<{
    title: string
    slug: string
    pageType: string
    componentCount: number
  }>
  currentPage?: {
    title: string
    slug: string
    pageType: string
    components: Array<{ name: string; componentType: string }>
  }
}

// ── System prompt builder ─────────────────────────────────────────────────────

function buildSystemPrompt(ctx: AiStoreContext): string {
  const lines: string[] = [
    `You are FlowMerce AI, a smart e-commerce design assistant.`,
    `You help merchants build great-looking, high-converting online stores.`,
    ``,
    `LANGUAGE RULE: Detect the language of each user message and always reply in that exact language.`,
    `If the user writes in Arabic, reply entirely in Arabic.`,
    `If the user writes in English, reply entirely in English.`,
    ``,
    `Store context:`,
  ]

  if (ctx.storeName) lines.push(`- Store name: ${ctx.storeName}`)
  if (ctx.status)    lines.push(`- Storefront status: ${ctx.status}`)

  if (ctx.themeColors) {
    const c = ctx.themeColors
    lines.push(
      `- Current theme: Background ${c.background ?? 'N/A'} · Header ${c.header ?? 'N/A'} · Footer ${c.footer ?? 'N/A'} · Accent/CTA ${c.accent ?? 'N/A'} · Body text ${c.text ?? 'N/A'} · Card ${c.card ?? 'N/A'}`
    )
  }

  if (ctx.pages) {
    if (ctx.pages.length > 0) {
      const list = ctx.pages
        .map((p) => `"${p.title}" (${p.pageType}, ${p.componentCount} component${p.componentCount !== 1 ? 's' : ''})`)
        .join('; ')
      lines.push(`- Pages created (${ctx.pages.length}): ${list}`)
    } else {
      lines.push(`- No pages created yet`)
    }
  }

  if (ctx.currentPage) {
    const pg = ctx.currentPage
    lines.push(``, `Currently editing: "${pg.title}" (type: ${pg.pageType}, slug: /${pg.slug})`)
    if (pg.components.length > 0) {
      lines.push(
        `Components on this page: ${pg.components.map((c) => `${c.componentType}:"${c.name}"`).join(', ')}`
      )
    } else {
      lines.push(`This page has no components yet.`)
    }
  }

  lines.push(
    ``,
    `Available component types: HERO, TEXT, IMAGE, PRODUCT_GRID, CATEGORY_LIST, CTA, SPACER, DIVIDER`,
    ``,
    `Your capabilities — always be specific and actionable:`,
    `1. Color palette: evaluate WCAG contrast, brand fit, conversion impact. Format hex suggestions as: Field → #HEXCODE`,
    `2. Page planning: suggest which pages to create based on the store type`,
    `3. Component layout: recommend what components to add and in what order for each page type`,
    `4. Conversion optimization: CTA placement, trust signals, UX best practices for e-commerce`,
    ``,
    `Keep every response under 150 words. Be direct, friendly, and actionable.`
  )

  return lines.join('\n')
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  fab: {
    position: 'fixed' as const,
    bottom: 28,
    right: 28,
    width: 52,
    height: 52,
    borderRadius: '50%',
    background: '#0F0E0C',
    color: '#fff',
    border: 'none',
    fontSize: 22,
    cursor: 'pointer',
    boxShadow: '0 4px 24px rgba(0,0,0,0.28)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 500,
    transition: 'transform 0.15s, box-shadow 0.15s',
    lineHeight: 1,
  },
  panel: {
    position: 'fixed' as const,
    bottom: 92,
    right: 28,
    width: 380,
    maxHeight: 'calc(100vh - 130px)',
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
    border: '1px solid #ede8df',
    display: 'flex',
    flexDirection: 'column' as const,
    zIndex: 500,
    overflow: 'hidden',
  },
  header: {
    padding: '13px 16px',
    borderBottom: '1px solid #ede8df',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    background: '#faf8f5',
  },
  headerTitle: { fontSize: 13, fontWeight: 700, margin: 0, color: '#0F0E0C' } as const,
  headerSub:   { fontSize: 11, color: '#999', margin: '2px 0 0' } as const,
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 18,
    color: '#999',
    padding: '0 2px',
    lineHeight: 1,
  },
  quickPrompts: {
    padding: '10px 14px',
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap' as const,
    borderBottom: '1px solid #f0ebe0',
    flexShrink: 0,
  },
  quickBtn: {
    fontSize: 11,
    padding: '5px 11px',
    borderRadius: 20,
    border: '1px solid #e8e3d8',
    background: '#fff',
    cursor: 'pointer',
    color: '#0F0E0C',
    fontFamily: 'inherit',
    lineHeight: 1.4,
  },
  messages: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
    minHeight: 180,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 10,
    padding: '28px 20px',
    textAlign: 'center' as const,
  },
  emptyText: { fontSize: 12, color: '#bbb', margin: 0, lineHeight: 1.6 } as const,
  bubble: {
    padding: '10px 13px',
    borderRadius: 12,
    fontSize: 13,
    lineHeight: 1.55,
    maxWidth: '90%',
    wordBreak: 'break-word' as const,
    whiteSpace: 'pre-wrap' as const,
  },
  bubbleUser: {
    background: '#0F0E0C',
    color: '#fff',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 3,
  },
  bubbleAI: {
    background: '#f5f0e8',
    color: '#0F0E0C',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 3,
  },
  aiTag: {
    fontSize: 10,
    fontWeight: 700,
    color: '#aaa',
    margin: '0 0 5px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  inputWrap: {
    display: 'flex',
    gap: 8,
    padding: '10px 14px',
    borderTop: '1px solid #ede8df',
    flexShrink: 0,
    alignItems: 'flex-end',
    background: '#fafaf8',
  },
  textarea: {
    flex: 1,
    resize: 'none' as const,
    border: '1px solid #e8e3d8',
    borderRadius: 10,
    padding: '8px 12px',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    lineHeight: 1.5,
    background: '#fff',
  },
  sendBtn: {
    background: '#0F0E0C',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    width: 36,
    height: 36,
    cursor: 'pointer',
    fontSize: 14,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4, cursor: 'not-allowed' as const },
  hint: { fontSize: 10, color: '#ccc', textAlign: 'center' as const, padding: '4px 14px 8px', margin: 0 } as const,
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ChatMsg = { role: 'user' | 'assistant'; content: string }

interface AiChatPanelProps {
  context: AiStoreContext
  quickPrompts?: string[]
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AiChatPanel({ context, quickPrompts }: AiChatPanelProps) {
  const [open, setOpen]       = useState(false)
  const [chat, setChat]       = useState<ChatMsg[]>([])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  const prompts = quickPrompts ?? [
    'Suggest pages for my store',
    'Evaluate my theme colors',
    'How do I increase conversions?',
    'Is my store ready to publish?',
  ]

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
          system: buildSystemPrompt(context),
          messages: newChat,
        }),
      })
      const data = (await res.json()) as { reply?: string }
      const reply = data.reply ?? 'Sorry, could not get a response. Please try again.'
      setChat((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setChat((prev) => [
        ...prev,
        { role: 'assistant', content: 'Connection error. Please check your network and try again.' },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => chatRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 80)
    }
  }

  return (
    <>
      <button
        type="button"
        style={S.fab}
        onClick={() => setOpen((v) => !v)}
        title="FlowMerce AI Design Assistant"
        aria-label="Toggle AI assistant"
      >
        {open ? '✕' : '✦'}
      </button>

      {open && (
        <div style={S.panel} role="dialog" aria-label="FlowMerce AI Assistant">
          <div style={S.header}>
            <div>
              <p style={S.headerTitle}>✦ FlowMerce AI</p>
              <p style={S.headerSub}>Design assistant</p>
            </div>
            <button
              type="button"
              style={S.closeBtn}
              onClick={() => setOpen(false)}
              aria-label="Close AI panel"
            >
              ×
            </button>
          </div>

          <div style={S.quickPrompts}>
            {prompts.map((q) => (
              <button
                key={q}
                type="button"
                style={S.quickBtn}
                onClick={() => void sendMessage(q)}
                disabled={loading}
              >
                {q}
              </button>
            ))}
          </div>

          <div ref={chatRef} style={S.messages}>
            {chat.length === 0 && (
              <div style={S.empty}>
                <span style={{ fontSize: 32, opacity: 0.1 }}>✦</span>
                <p style={S.emptyText}>
                  Ask me about colors, pages, components,
                  <br />
                  or how to build a better store.
                </p>
              </div>
            )}

            {chat.map((m, i) => (
              <div
                key={i}
                style={{
                  ...S.bubble,
                  ...(m.role === 'user' ? S.bubbleUser : S.bubbleAI),
                }}
              >
                {m.role === 'assistant' && <p style={S.aiTag}>FlowMerce AI</p>}
                <p style={{ margin: 0 }}>{m.content}</p>
              </div>
            ))}

            {loading && (
              <div style={{ ...S.bubble, ...S.bubbleAI }}>
                <p style={S.aiTag}>FlowMerce AI</p>
                <p style={{ margin: 0, opacity: 0.5 }}>Analyzing...</p>
              </div>
            )}
          </div>

          <div style={S.inputWrap}>
            <textarea
              style={S.textarea}
              value={input}
              rows={2}
              placeholder="Ask anything about your store design..."
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
          <p style={S.hint}>Enter to send · Shift+Enter for new line</p>
        </div>
      )}
    </>
  )
}

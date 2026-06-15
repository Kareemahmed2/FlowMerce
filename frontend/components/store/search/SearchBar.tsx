'use client'

import { useRef } from 'react'

type Props = {
  value: string
  onSearch: (query: string) => void
  onChange?: (query: string) => void
  placeholder?: string
  accent: string
  cardBg: string
  textColor: string
  size?: 'sm' | 'lg'
  /** aria-label for the input */
  label?: string
  autoFocus?: boolean
}

/**
 * Reusable search bar — no service calls, no URL logic.
 * Used in two contexts:
 *  - Search page: `onChange` → debounced URL update, `onSearch` → immediate submit
 *  - StoreHeader: `onSearch` → navigate to /search?q=...
 */
export default function SearchBar({
  value,
  onSearch,
  onChange,
  placeholder = 'Search products…',
  accent,
  cardBg,
  textColor,
  size = 'lg',
  label = 'Search products',
  autoFocus = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = inputRef.current?.value ?? value
    onSearch(q.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onSearch('')
      inputRef.current?.blur()
    }
  }

  const height = size === 'sm' ? 38 : 52
  const fontSize = size === 'sm' ? 14 : 16
  const iconSize = size === 'sm' ? 16 : 20

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      style={{ display: 'flex', width: '100%', gap: 0 }}
    >
      <div style={{ position: 'relative', flex: 1 }}>
        {/* Search icon */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: size === 'sm' ? 10 : 16,
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#aaa',
            display: 'flex',
            pointerEvents: 'none',
          }}
        >
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>

        <input
          ref={inputRef}
          type="search"
          role="searchbox"
          aria-label={label}
          autoComplete="off"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            width: '100%',
            height,
            paddingLeft: size === 'sm' ? 34 : 48,
            paddingRight: value ? (size === 'sm' ? 34 : 48) : 16,
            background: cardBg,
            color: textColor,
            border: '1.5px solid #e5e7eb',
            borderRight: 'none',
            borderRadius: size === 'sm' ? '8px 0 0 8px' : '12px 0 0 12px',
            fontSize,
            fontFamily: 'inherit',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = accent }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb' }}
        />

        {/* Clear button */}
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              onChange?.('')
              onSearch('')
              inputRef.current?.focus()
            }}
            style={{
              position: 'absolute',
              right: size === 'sm' ? 8 : 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#aaa',
              display: 'flex',
              alignItems: 'center',
              padding: 2,
              borderRadius: 4,
            }}
          >
            <svg width={size === 'sm' ? 14 : 16} height={size === 'sm' ? 14 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        aria-label="Submit search"
        style={{
          height,
          padding: size === 'sm' ? '0 14px' : '0 24px',
          background: accent,
          color: '#fff',
          border: 'none',
          borderRadius: size === 'sm' ? '0 8px 8px 0' : '0 12px 12px 0',
          fontSize: size === 'sm' ? 13 : 15,
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          fontFamily: 'inherit',
          transition: 'opacity 0.2s',
        }}
      >
        {size === 'sm' ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        ) : 'Search'}
      </button>
    </form>
  )
}

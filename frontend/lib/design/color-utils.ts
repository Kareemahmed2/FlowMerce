/** WCAG-style contrast helpers for hex colors */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, '')
  if (h.length !== 6) return [0, 0, 0]
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return [r, g, b]
}

export function luminance(rgb: [number, number, number]): number {
  const sRGB = rgb.map((v) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2]
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = luminance(hexToRgb(hex1))
  const l2 = luminance(hexToRgb(hex2))
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return +((lighter + 0.05) / (darker + 0.05)).toFixed(2)
}

export function contrastLabel(ratio: number): {
  label: string
  color: string
  bg: string
} {
  if (ratio >= 7) return { label: 'AAA', color: '#3B6D11', bg: '#EAF3DE' }
  if (ratio >= 4.5) return { label: 'AA', color: '#185FA5', bg: '#E6F1FB' }
  if (ratio >= 3) return { label: 'AA Large', color: '#854F0B', bg: '#FAEEDA' }
  return { label: 'Fail', color: '#A32D2D', bg: '#FCEBEB' }
}

export const SETTINGS_SECTIONS = [
  { id: 'store', label: 'Store Info', icon: '◈' },
  { id: 'payment', label: 'Payment', icon: '◎' },
  { id: 'shipping', label: 'Shipping', icon: '▷' },
  { id: 'integrations', label: 'Integrations', icon: '⚙' },
  { id: 'notifications', label: 'Notifications', icon: '◉' },
  { id: 'tax', label: 'Tax & Compliance', icon: '▦' },
  { id: 'security', label: 'Security', icon: '⊙' },
  { id: 'danger', label: 'Danger Zone', icon: '⚠' },
] as const

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id']

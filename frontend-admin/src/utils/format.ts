export function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  const seconds = Math.round(ms / 1000)
  const mm = Math.floor(seconds / 60)
  const ss = seconds % 60
  return `${mm}:${ss.toString().padStart(2, '0')}`
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('ru', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function formatPhone(phone: string | null): string {
  if (!phone) return 'Без номера'
  // crude E.164 prettify: +7 (916) 123-45-67
  if (/^\+7\d{10}$/.test(phone)) {
    return `+7 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10)}`
  }
  return phone
}

// Voice prompts inject "+" before stressed vowels for TTS pronunciation
// (e.g. "Эл+айнер"). Strip them for human-readable display.
export function stripStress(s: string | null | undefined): string {
  return (s ?? '').replace(/\+/g, '')
}

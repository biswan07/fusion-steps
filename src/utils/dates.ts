export function formatDateDDMMYYYY(date: Date): string {
  const aest = getAESTDate(date)
  const day = String(aest.getDate()).padStart(2, '0')
  const month = String(aest.getMonth() + 1).padStart(2, '0')
  const year = aest.getFullYear()
  return `${day}/${month}/${year}`
}

export function getAESTDate(date: Date): Date {
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '0'
  return new Date(
    parseInt(get('year')),
    parseInt(get('month')) - 1,
    parseInt(get('day')),
    parseInt(get('hour')),
    parseInt(get('minute')),
    parseInt(get('second'))
  )
}

export function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function getCurrentDayAEST(): string {
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    weekday: 'long',
  })
  return formatter.format(new Date())
}

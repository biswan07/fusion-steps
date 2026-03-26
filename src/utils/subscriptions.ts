export type BalanceColor = 'red' | 'orange' | 'green'

export function getBalanceColor(classesRemaining: number): BalanceColor {
  if (classesRemaining <= 2) return 'red'
  if (classesRemaining <= 4) return 'orange'
  return 'green'
}

export function isLowBalance(classesRemaining: number): boolean {
  return classesRemaining <= 2
}

export function getBalanceLabel(classesRemaining: number): string {
  if (classesRemaining === 0) return 'No classes left'
  if (classesRemaining === 1) return '1 class left'
  return `${classesRemaining} classes left`
}

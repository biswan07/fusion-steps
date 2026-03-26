import { getBalanceColor, getBalanceLabel } from '../utils/subscriptions'

const colorClasses = {
  red: 'bg-[#E91E8C]/20 text-[#E91E8C]',
  orange: 'bg-[#FF6F00]/20 text-[#FF6F00]',
  green: 'bg-emerald-500/20 text-emerald-400',
}

interface Props {
  classesRemaining: number
}

export function SubscriptionBadge({ classesRemaining }: Props) {
  const color = getBalanceColor(classesRemaining)
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${colorClasses[color]}`}>
      {getBalanceLabel(classesRemaining)}
    </span>
  )
}

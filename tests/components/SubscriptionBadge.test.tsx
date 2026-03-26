import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SubscriptionBadge } from '../../src/components/SubscriptionBadge'

describe('SubscriptionBadge', () => {
  it('shows red badge for 1 class left', () => {
    render(<SubscriptionBadge classesRemaining={1} />)
    expect(screen.getByText('1 class left')).toBeInTheDocument()
  })

  it('shows green badge for 10 classes', () => {
    render(<SubscriptionBadge classesRemaining={10} />)
    expect(screen.getByText('10 classes left')).toBeInTheDocument()
  })

  it('shows no classes message for 0', () => {
    render(<SubscriptionBadge classesRemaining={0} />)
    expect(screen.getByText('No classes left')).toBeInTheDocument()
  })
})

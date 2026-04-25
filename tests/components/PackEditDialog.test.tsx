import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PackEditDialog } from '../../src/components/PackEditDialog'

describe('PackEditDialog — resize mode', () => {
  it('renders dropdown for new pack size and pre-fills new remaining', () => {
    render(
      <PackEditDialog
        mode="resize"
        currentPackSize={5}
        currentRemaining={3}
        onClose={() => {}}
        onConfirm={() => Promise.resolve()}
      />
    )
    expect(screen.getByLabelText(/new pack size/i)).toBeInTheDocument()
    const remaining = screen.getByLabelText(/new remaining/i) as HTMLInputElement
    expect(remaining.value).toBe('3')
  })

  it('updates pre-filled remaining when pack size changes', () => {
    render(
      <PackEditDialog
        mode="resize"
        currentPackSize={5}
        currentRemaining={3}
        onClose={() => {}}
        onConfirm={() => Promise.resolve()}
      />
    )
    fireEvent.change(screen.getByLabelText(/new pack size/i), { target: { value: '10' } })
    const remaining = screen.getByLabelText(/new remaining/i) as HTMLInputElement
    expect(remaining.value).toBe('8')
  })

  it('disables confirm when no field differs', () => {
    render(
      <PackEditDialog
        mode="resize"
        currentPackSize={5}
        currentRemaining={3}
        onClose={() => {}}
        onConfirm={() => Promise.resolve()}
      />
    )
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('disables confirm if newRemaining > newPackSize', () => {
    render(
      <PackEditDialog
        mode="resize"
        currentPackSize={5}
        currentRemaining={3}
        onClose={() => {}}
        onConfirm={() => Promise.resolve()}
      />
    )
    fireEvent.change(screen.getByLabelText(/new remaining/i), { target: { value: '6' } })
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('calls onConfirm with new values', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <PackEditDialog
        mode="resize"
        currentPackSize={5}
        currentRemaining={3}
        onClose={() => {}}
        onConfirm={onConfirm}
      />
    )
    fireEvent.change(screen.getByLabelText(/new pack size/i), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledWith({
      mode: 'resize', newPackSize: 10, newClassesRemaining: 8,
    })
  })
})

describe('PackEditDialog — backdate-count mode', () => {
  it('shows an "already used" input bounded by currentRemaining', () => {
    render(
      <PackEditDialog
        mode="backdate-count"
        currentPackSize={10}
        currentRemaining={10}
        onClose={() => {}}
        onConfirm={() => Promise.resolve()}
      />
    )
    expect(screen.getByLabelText(/already used/i)).toBeInTheDocument()
  })

  it('disables confirm if usedCount > currentRemaining', () => {
    render(
      <PackEditDialog
        mode="backdate-count"
        currentPackSize={5}
        currentRemaining={3}
        onClose={() => {}}
        onConfirm={() => Promise.resolve()}
      />
    )
    fireEvent.change(screen.getByLabelText(/already used/i), { target: { value: '5' } })
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('calls onConfirm with usedCount', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <PackEditDialog
        mode="backdate-count"
        currentPackSize={10}
        currentRemaining={10}
        onClose={() => {}}
        onConfirm={onConfirm}
      />
    )
    fireEvent.change(screen.getByLabelText(/already used/i), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledWith({ mode: 'backdate-count', usedCount: 3 })
  })
})

describe('PackEditDialog — backdate-dates mode', () => {
  it('lets the teacher add and remove date chips', () => {
    render(
      <PackEditDialog
        mode="backdate-dates"
        currentPackSize={10}
        currentRemaining={10}
        onClose={() => {}}
        onConfirm={() => Promise.resolve()}
      />
    )
    fireEvent.change(screen.getByLabelText(/add date/i), { target: { value: '2026-04-20' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(screen.getByText(/20\/04\/2026/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /remove 20\/04\/2026/i }))
    expect(screen.queryByText(/20\/04\/2026/)).not.toBeInTheDocument()
  })

  it('exposes min and max bounds on the date picker', () => {
    render(
      <PackEditDialog
        mode="backdate-dates"
        currentPackSize={10}
        currentRemaining={10}
        onClose={() => {}}
        onConfirm={() => Promise.resolve()}
      />
    )
    const picker = screen.getByLabelText(/add date/i) as HTMLInputElement
    expect(picker.min).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(picker.max).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('disables confirm when more dates added than currentRemaining', () => {
    render(
      <PackEditDialog
        mode="backdate-dates"
        currentPackSize={5}
        currentRemaining={1}
        onClose={() => {}}
        onConfirm={() => Promise.resolve()}
      />
    )
    fireEvent.change(screen.getByLabelText(/add date/i), { target: { value: '2026-04-20' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    fireEvent.change(screen.getByLabelText(/add date/i), { target: { value: '2026-04-21' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('calls onConfirm with the chosen dates', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <PackEditDialog
        mode="backdate-dates"
        currentPackSize={10}
        currentRemaining={10}
        onClose={() => {}}
        onConfirm={onConfirm}
      />
    )
    fireEvent.change(screen.getByLabelText(/add date/i), { target: { value: '2026-04-20' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const call = onConfirm.mock.calls[0][0]
    expect(call.mode).toBe('backdate-dates')
    expect(call.dates).toHaveLength(1)
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ModalProvider, useConfirm } from './ModalContext'

function ConfirmHarness({ options }) {
  const confirm = useConfirm()

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void confirm(options).then((result) => {
            const el = document.getElementById('confirm-result')
            if (el) el.textContent = String(result)
          })
        }}
      >
        Open confirm
      </button>
      <span id="confirm-result" data-testid="confirm-result" />
    </div>
  )
}

describe('ModalContext', () => {
  it('resolves true when Confirm is clicked', async () => {
    render(
      <ModalProvider>
        <ConfirmHarness options={{ title: 'Delete item', message: 'Are you sure?' }} />
      </ModalProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open confirm' }))

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('Delete item')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-result')).toHaveTextContent('true')
    })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('resolves false when Cancel is clicked', async () => {
    render(
      <ModalProvider>
        <ConfirmHarness
          options={{
            title: 'Discard changes',
            message: 'Unsaved work will be lost.',
            cancelLabel: 'Keep editing',
          }}
        />
      </ModalProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open confirm' }))

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-result')).toHaveTextContent('false')
    })
  })

  it('throws when useConfirm is used outside ModalProvider', () => {
    function Orphan() {
      useConfirm()
      return null
    }

    expect(() => render(<Orphan />)).toThrow(/ModalProvider/)
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ModalProvider, useAlert, useConfirm } from './ModalContext'

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

function AlertHarness({ options }) {
  const alert = useAlert()

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void alert(options).then((result) => {
            const el = document.getElementById('alert-result')
            if (el) el.textContent = String(result)
          })
        }}
      >
        Open alert
      </button>
      <span id="alert-result" data-testid="alert-result" />
    </div>
  )
}

function DualConfirmHarness() {
  const confirm = useConfirm()

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void confirm({ title: 'First', message: 'One' })
          void confirm({ title: 'Second', message: 'Two' }).then((result) => {
            const el = document.getElementById('dual-result')
            if (el) el.textContent = String(result)
          })
        }}
      >
        Open stacked confirms
      </button>
      <span id="dual-result" data-testid="dual-result" />
    </>
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

  it('supports string shorthand messages for confirm', async () => {
    render(
      <ModalProvider>
        <ConfirmHarness options="Plain string message" />
      </ModalProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open confirm' }))
    expect(await screen.findByText('Plain string message')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-result')).toHaveTextContent('true')
    })
  })

  it('renders destructive confirm styling', async () => {
    render(
      <ModalProvider>
        <ConfirmHarness
          options={{ title: 'Delete group', message: 'Permanent.', destructive: true }}
        />
      </ModalProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open confirm' }))
    const confirmBtn = await screen.findByRole('button', { name: 'Confirm' })
    expect(confirmBtn.className).toMatch(/bg-red-600/)
  })

  it('resolves false when Escape is pressed on a confirm dialog', async () => {
    render(
      <ModalProvider>
        <ConfirmHarness options={{ title: 'Escape test', message: 'Press esc' }} />
      </ModalProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open confirm' }))
    await screen.findByRole('alertdialog')
    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.getByTestId('confirm-result')).toHaveTextContent('false')
    })
  })

  it('resolves false when clicking the backdrop on a confirm dialog', async () => {
    render(
      <ModalProvider>
        <ConfirmHarness options={{ title: 'Backdrop', message: 'Click outside' }} />
      </ModalProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open confirm' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.mouseDown(dialog.parentElement)

    await waitFor(() => {
      expect(screen.getByTestId('confirm-result')).toHaveTextContent('false')
    })
  })

  it('preempts an open confirm when another confirm is requested', async () => {
    render(
      <ModalProvider>
        <DualConfirmHarness />
      </ModalProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open stacked confirms' }))
    expect(await screen.findByText('Second')).toBeInTheDocument()
    expect(screen.queryByText('First')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => {
      expect(screen.getByTestId('dual-result')).toHaveTextContent('true')
    })
  })

  it('shows an info alert with default title and resolves on OK', async () => {
    render(
      <ModalProvider>
        <AlertHarness options={{ message: 'Saved successfully.' }} />
      </ModalProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open alert' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('Notice')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() => {
      expect(screen.getByTestId('alert-result')).toHaveTextContent('undefined')
    })
  })

  it('shows an error alert with custom labels', async () => {
    render(
      <ModalProvider>
        <AlertHarness
          options={{
            type: 'error',
            title: 'Upload failed',
            message: 'Try again later.',
            confirmLabel: 'Dismiss',
          }}
        />
      </ModalProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open alert' }))
    expect(await screen.findByText('Upload failed')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })

  it('closes an alert when Escape is pressed', async () => {
    render(
      <ModalProvider>
        <AlertHarness options={{ message: 'Alert escape' }} />
      </ModalProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open alert' }))
    await screen.findByRole('alertdialog')
    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })

  it('throws when useConfirm is used outside ModalProvider', () => {
    function Orphan() {
      useConfirm()
      return null
    }

    expect(() => render(<Orphan />)).toThrow(/ModalProvider/)
  })

  it('renders confirm without a title when options omit it', async () => {
    render(
      <ModalProvider>
        <ConfirmHarness options={{ title: '', message: 'Title-less confirm' }} />
      </ModalProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open confirm' }))
    expect(await screen.findByText('Title-less confirm')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
  })

  it('closes an alert when clicking the backdrop', async () => {
    render(
      <ModalProvider>
        <AlertHarness options={{ message: 'Backdrop alert' }} />
      </ModalProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open alert' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.mouseDown(dialog.parentElement)

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })

  it('uses the default error alert title when type is error', async () => {
    render(
      <ModalProvider>
        <AlertHarness options={{ type: 'error', message: 'Boom' }} />
      </ModalProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open alert' }))
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Boom')).toBeInTheDocument()
  })

  it('supports string shorthand for alert messages', async () => {
    render(
      <ModalProvider>
        <AlertHarness options="Quick notice" />
      </ModalProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open alert' }))
    expect(await screen.findByText('Quick notice')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })

  it('throws when useAlert is used outside ModalProvider', () => {
    function Orphan() {
      useAlert()
      return null
    }

    expect(() => render(<Orphan />)).toThrow(/ModalProvider/)
  })
})

/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { CircleAlert, Info } from 'lucide-react'
import { btnPrimary, btnSecondary, cardLight } from '../ui'

const ModalContext = createContext(null)

const INITIAL = {
  open: false,
  mode: 'confirm',
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  destructive: false,
  alertType: 'info',
}

function normalizeMessage(options) {
  return typeof options === 'string' ? options : (options.message ?? '')
}

function AppDialog({
  open,
  mode,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  alertType,
  onConfirm,
  onCancel,
}) {
  const titleId = useId()
  const descId = useId()
  const isAlert = mode === 'alert'
  const Icon = alertType === 'error' ? CircleAlert : Info
  const iconClass =
    alertType === 'error'
      ? 'text-red-600 dark:text-red-400'
      : 'text-emerald-600 dark:text-emerald-400'

  const acknowledge = onConfirm

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isAlert) acknowledge()
        else onCancel()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prev
    }
  }, [open, isAlert, acknowledge, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          if (isAlert) acknowledge()
          else onCancel()
        }
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? descId : undefined}
        className={`${cardLight} w-full max-w-md p-6 shadow-xl`}
      >
        <div className="mb-4 flex gap-3">
          <Icon className={`mt-0.5 h-6 w-6 shrink-0 ${iconClass}`} aria-hidden />
          <div className="min-w-0 flex-1">
            {title ? (
              <h2
                id={titleId}
                className="text-lg font-semibold text-stone-900 dark:text-stone-100"
              >
                {title}
              </h2>
            ) : null}
            {message ? (
              <p
                id={descId}
                className={`text-sm text-stone-600 dark:text-stone-300 ${title ? 'mt-2' : ''}`}
              >
                {message}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {!isAlert ? (
            <button type="button" onClick={onCancel} className={btnSecondary}>
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            autoFocus
            onClick={acknowledge}
            className={
              !isAlert && destructive
                ? 'rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50'
                : btnPrimary
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ModalProvider({ children }) {
  const [state, setState] = useState(INITIAL)
  const resolverRef = useRef(null)
  const modeRef = useRef('confirm')

  const settle = useCallback((result) => {
    resolverRef.current?.(result)
    resolverRef.current = null
    setState(INITIAL)
  }, [])

  const handleConfirm = useCallback(() => {
    if (modeRef.current === 'alert') settle(undefined)
    else settle(true)
  }, [settle])

  const handleCancel = useCallback(() => {
    if (modeRef.current === 'alert') settle(undefined)
    else settle(false)
  }, [settle])

  const preempt = useCallback(() => {
    if (!resolverRef.current) return
    if (modeRef.current === 'alert') resolverRef.current(undefined)
    else resolverRef.current(false)
    resolverRef.current = null
  }, [])

  const confirm = useCallback((options = {}) => {
    preempt()
    const message = normalizeMessage(options)
    return new Promise((resolve) => {
      modeRef.current = 'confirm'
      resolverRef.current = resolve
      setState({
        open: true,
        mode: 'confirm',
        title: options.title ?? 'Confirm',
        message,
        confirmLabel: options.confirmLabel ?? 'Confirm',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        destructive: Boolean(options.destructive),
        alertType: 'info',
      })
    })
  }, [preempt])

  const alert = useCallback((options = {}) => {
    preempt()
    const message = normalizeMessage(options)
    const alertType = options.type === 'error' ? 'error' : 'info'
    return new Promise((resolve) => {
      modeRef.current = 'alert'
      resolverRef.current = resolve
      setState({
        open: true,
        mode: 'alert',
        title:
          options.title ??
          (alertType === 'error' ? 'Something went wrong' : 'Notice'),
        message,
        confirmLabel: options.confirmLabel ?? 'OK',
        cancelLabel: '',
        destructive: false,
        alertType,
      })
    })
  }, [preempt])

  const value = { confirm, alert }

  return (
    <ModalContext.Provider value={value}>
      {children}
      <AppDialog
        {...state}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ModalContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ModalContext)
  if (!ctx) {
    throw new Error('useConfirm must be used within ModalProvider')
  }
  return ctx.confirm
}

export function useAlert() {
  const ctx = useContext(ModalContext)
  if (!ctx) {
    throw new Error('useAlert must be used within ModalProvider')
  }
  return ctx.alert
}

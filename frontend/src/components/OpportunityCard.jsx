import { Link } from 'react-router-dom'
import { Landmark, Users, Wallet } from 'lucide-react'
import {
  btnPrimary,
  captionMuted,
  opportunityCard,
  opportunityIconBubble,
  cardTitle,
  bodyMuted,
  opportunityMetricCell,
  opportunityMetricsRow,
} from '../styles/tokens'

const ICONS = {
  users: Users,
  wallet: Wallet,
  landmark: Landmark,
}

/**
 * @param {object} props
 * @param {string} props.name
 * @param {string} props.subtitle
 * @param {{ label: string, value: string }[]} props.metrics — expect two items for layout
 * @param {'users'|'wallet'|'landmark'} props.icon
 * @param {string} [props.applyHref]
 * @param {() => void | Promise<void>} [props.onApply]
 * @param {boolean} [props.isJoining]
 */
export default function OpportunityCard({
  name,
  subtitle,
  metrics,
  icon,
  applyHref = '/auth',
  onApply,
  isJoining = false,
}) {
  const Icon = ICONS[icon] ?? ICONS.users
  const [m1, m2] = metrics

  return (
    <article className={opportunityCard}>
      <div className="flex items-start gap-4">
        <div className={opportunityIconBubble}>
          <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className={cardTitle}>{name}</h3>
          <p className={`mt-0.5 ${bodyMuted}`}>{subtitle}</p>
        </div>
      </div>

      <div className={opportunityMetricsRow}>
        {m1 ? (
          <div className={opportunityMetricCell}>
            <p className="text-sm font-semibold text-emerald-900">{m1.value}</p>
            <p className={`mt-0.5 ${captionMuted}`}>{m1.label}</p>
          </div>
        ) : null}
        {m2 ? (
          <div className={opportunityMetricCell}>
            <p className="text-sm font-semibold text-emerald-900">{m2.value}</p>
            <p className={`mt-0.5 ${captionMuted}`}>{m2.label}</p>
          </div>
        ) : null}
      </div>

      {typeof onApply === 'function' ? (
        <button
          type="button"
          onClick={onApply}
          disabled={isJoining}
          className={`${btnPrimary} mt-6 inline-flex w-full items-center justify-center sm:mt-auto disabled:cursor-not-allowed disabled:opacity-70`}
        >
          {isJoining ? 'Joining...' : 'Apply to join'}
        </button>
      ) : (
        <Link
          to={applyHref}
          className={`${btnPrimary} mt-6 inline-flex w-full items-center justify-center sm:mt-auto`}
        >
          Apply to join
        </Link>
      )}
    </article>
  )
}

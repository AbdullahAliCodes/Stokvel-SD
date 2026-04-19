import { Navigate, useParams } from 'react-router-dom'

/** `/group/:stokvel_id` → default child tab */
export function GroupScopeIndexRedirect() {
  const { stokvel_id } = useParams()
  if (!stokvel_id) return <Navigate to="/dashboard" replace />
  return <Navigate to={`/group/${stokvel_id}/dashboard`} replace />
}

/** Old `/stokvels/:id` → scoped member area (payments & finances). */
export function LegacyStokvelToGroup() {
  const { id } = useParams()
  if (!id) return <Navigate to="/dashboard" replace />
  return <Navigate to={`/group/${id}/payments`} replace />
}

/** Legacy flat payout page → scoped payments when a last group is known. */
export function LegacyMyPayoutRedirect() {
  const last =
    typeof localStorage !== 'undefined' ? localStorage.getItem('last_stokvel_id') : null
  if (last) return <Navigate to={`/group/${last}/payments`} replace />
  return <Navigate to="/dashboard" replace />
}

/** Old flat meetings list → gateway picks a group. */
export function LegacyMeetingsListRedirect() {
  return <Navigate to="/dashboard" replace />
}

/** Old `/meetings/:id` → scoped meeting when we know last group, else gateway. */
export function LegacyMeetingDetailRedirect() {
  const { id: meetingId } = useParams()
  const last =
    typeof localStorage !== 'undefined' ? localStorage.getItem('last_stokvel_id') : null
  if (last && meetingId) {
    return <Navigate to={`/group/${last}/meetings/${meetingId}`} replace />
  }
  return <Navigate to="/dashboard" replace />
}

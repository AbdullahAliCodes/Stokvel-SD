import { generatePayoutSchedule } from './dates.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeUuid(id) {
  if (typeof id !== 'string') return ''
  const t = id.trim().toLowerCase()
  return UUID_RE.test(t) ? t : ''
}

function normalizeUuidArray(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  const seen = new Set()
  for (const x of raw) {
    const u = normalizeUuid(x)
    if (!u || seen.has(u)) continue
    seen.add(u)
    out.push(u)
  }
  return out
}

/** Fisher–Yates shuffle using crypto.getRandomValues (low bias for typical N). */
export function shuffleMemberIds(ids) {
  const a = [...ids]
  for (let i = a.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    const j = buf[0] % (i + 1)
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
}

function sameSet(a, b) {
  if (a.length !== b.length) return false
  const sa = new Set(a)
  const sb = new Set(b)
  if (sa.size !== sb.size) return false
  for (const x of sa) {
    if (!sb.has(x)) return false
  }
  return true
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} serviceSupabase Service-role client (bypasses RLS).
 * @param {{ activationInstant?: Date }} [opts]
 * @returns {Promise<{ ok: boolean, error?: string, skipped?: boolean, payoutCount?: number }>}
 */
export async function activateStokvel(stokvelId, serviceSupabase, opts = {}) {
  if (!serviceSupabase) {
    return { ok: false, error: 'Service Supabase client is required.' }
  }

  const activationInstant =
    opts.activationInstant instanceof Date ? opts.activationInstant : new Date()

  const { data: stokvel, error: selErr } = await serviceSupabase
    .from('stokvels')
    .select(
      'id, status, type, cycle_length, payout_order_type, proposed_payout_sequence, payout_sequence',
    )
    .eq('id', stokvelId)
    .maybeSingle()

  if (selErr) {
    return { ok: false, error: selErr.message || String(selErr) }
  }
  if (!stokvel?.id) {
    return { ok: false, error: 'Stokvel not found.' }
  }

  if (stokvel.status === 'active') {
    const { count, error: cErr } = await serviceSupabase
      .from('payouts')
      .select('id', { count: 'exact', head: true })
      .eq('stokvel_id', stokvelId)
    if (!cErr && (count ?? 0) > 0) {
      return { ok: true, skipped: true, payoutCount: count }
    }
  } else if (stokvel.status !== 'pending') {
    return { ok: false, error: `Cannot activate stokvel in status "${stokvel.status}".` }
  }

  const cycleLen = Number(stokvel.cycle_length)
  if (!Number.isInteger(cycleLen) || cycleLen < 1 || cycleLen > 240) {
    return { ok: false, error: 'Invalid cycle_length on stokvel.' }
  }

  const { data: memberRows, error: memErr } = await serviceSupabase
    .from('stokvel_members')
    .select('user_id')
    .eq('stokvel_id', stokvelId)

  if (memErr) {
    return { ok: false, error: memErr.message || String(memErr) }
  }

  const memberIds = normalizeUuidArray((memberRows ?? []).map((r) => r.user_id)).sort()

  if (memberIds.length !== cycleLen) {
    return {
      ok: false,
      error: `Member count (${memberIds.length}) must equal cycle_length (${cycleLen}) before activation.`,
    }
  }

  const orderType =
    String(stokvel.payout_order_type || 'randomize').toLowerCase() === 'manual'
      ? 'manual'
      : 'randomize'

  let finalSequence

  if (orderType === 'manual') {
    const proposed = normalizeUuidArray(stokvel.proposed_payout_sequence)
    if (proposed.length !== cycleLen || !sameSet(proposed, memberIds)) {
      return {
        ok: false,
        error:
          'Manual payout order: proposed_payout_sequence must list every member exactly once.',
      }
    }
    finalSequence = proposed
  } else {
    finalSequence = shuffleMemberIds(memberIds)
  }

  const { rows: scheduleRows } = generatePayoutSchedule(
    activationInstant,
    finalSequence,
    cycleLen,
    stokvel.type || 'Rotating',
  )

  if (scheduleRows.length === 0) {
    return { ok: false, error: 'Failed to compute payout schedule.' }
  }

  const payoutInserts = scheduleRows.map((r) => ({
    stokvel_id: stokvelId,
    user_id: r.user_id,
    target_month: r.target_month,
    scheduled_payout_date: r.scheduled_payout_date,
    cycle_index: r.cycle_index,
  }))

  const { error: delErr } = await serviceSupabase.from('payouts').delete().eq('stokvel_id', stokvelId)
  if (delErr) {
    return { ok: false, error: delErr.message || String(delErr) }
  }

  const { error: insErr } = await serviceSupabase.from('payouts').insert(payoutInserts)
  if (insErr) {
    return { ok: false, error: insErr.message || String(insErr) }
  }

  const { error: upErr } = await serviceSupabase
    .from('stokvels')
    .update({
      status: 'active',
      payout_sequence: finalSequence,
      payout_order_type: orderType,
    })
    .eq('id', stokvelId)

  if (upErr) {
    await serviceSupabase.from('payouts').delete().eq('stokvel_id', stokvelId)
    return { ok: false, error: upErr.message || String(upErr) }
  }

  return { ok: true, payoutCount: payoutInserts.length }
}

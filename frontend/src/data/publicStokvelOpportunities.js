/**
 * Demo “public stokvel” listings for the landing page.
 * Replace with API data, e.g. map `GET /api/public/stokvels` into this shape.
 *
 * @typedef {('users'|'wallet'|'landmark')} PublicStokvelIconKey
 * @typedef {{ label: string, value: string }} PublicStokvelMetric
 * @typedef {{
 *   id: string
 *   name: string
 *   subtitle: string
 *   icon: PublicStokvelIconKey
 *   metrics: [PublicStokvelMetric, PublicStokvelMetric]
 * }} PublicStokvelOpportunity
 */

/** @type {PublicStokvelOpportunity[]} */
export const PUBLIC_STOKVEL_OPPORTUNITIES = [
  {
    id: 'demo-avoille',
    name: 'Avoille Stokvel',
    subtitle: 'Monthly savings · Cape Town',
    icon: 'users',
    metrics: [
      { label: 'Members', value: '24' },
      { label: 'Cycle target', value: 'R12k' },
    ],
  },
  {
    id: 'demo-rosebank',
    name: 'Rosebank Savers',
    subtitle: 'Rotating payouts · Gauteng',
    icon: 'wallet',
    metrics: [
      { label: 'Members', value: '18' },
      { label: 'Cycle target', value: 'R8k' },
    ],
  },
  {
    id: 'demo-midrand',
    name: 'Midrand Builders',
    subtitle: 'Property focus · Hybrid',
    icon: 'landmark',
    metrics: [
      { label: 'Members', value: '32' },
      { label: 'Cycle target', value: 'R20k' },
    ],
  },
  {
    id: 'demo-durban',
    name: 'Durban Umhlanga Circle',
    subtitle: 'Weekly contributions · KZN',
    icon: 'wallet',
    metrics: [
      { label: 'Members', value: '15' },
      { label: 'Cycle target', value: 'R6k' },
    ],
  },
  {
    id: 'demo-pe',
    name: 'Gqeberha Teachers Fund',
    subtitle: 'Term-based · Eastern Cape',
    icon: 'users',
    metrics: [
      { label: 'Members', value: '21' },
      { label: 'Cycle target', value: 'R10k' },
    ],
  },
  {
    id: 'demo-bloem',
    name: 'Bloemfontein Family Stokvel',
    subtitle: 'Funeral + savings · Free State',
    icon: 'landmark',
    metrics: [
      { label: 'Members', value: '28' },
      { label: 'Cycle target', value: 'R14k' },
    ],
  },
]

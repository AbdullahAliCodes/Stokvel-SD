/**
 * Public / marketing design tokens (Tailwind class strings).
 * Warm cream base, forest green primary, sage hero, rose accents.
 */

// ——— Surfaces ———

export const pageBg = 'bg-[#faf8f5]'

export const textOnPage = 'text-emerald-950'

export const landingPageShell = `min-h-screen ${pageBg} ${textOnPage}`

/** Sticky header on cream */
export const topNavBar =
  'sticky top-0 z-20 border-b border-emerald-900/10 bg-[#faf8f5]/90 backdrop-blur-md'

/** Full-width sage / teal wash behind hero */
export const surfaceHero =
  'relative overflow-hidden bg-gradient-to-br from-emerald-50/90 via-[#f0f4ef] to-teal-50/80'

/** Hero: single column &lt; lg (1024px); two columns from lg — visual stacks first on tablets */
export const heroGrid =
  'relative grid w-full gap-10 py-12 md:py-16 lg:grid-cols-2 lg:items-center lg:gap-14 lg:py-20 xl:gap-16 xl:py-24'

/** Stat / progress strip under hero lead */
export const heroStatCluster =
  'mt-7 flex flex-wrap items-start gap-6 rounded-2xl border border-emerald-900/10 bg-white/50 px-4 py-3 shadow-sm shadow-emerald-900/[0.06] backdrop-blur-sm sm:mt-9 sm:gap-8 sm:px-5 sm:py-4 md:gap-10'

/** Main hero visual (media card) — tinted glass panel */
export const heroMediaCard =
  'overflow-hidden rounded-2xl border border-white/90 bg-white/70 shadow-xl shadow-emerald-900/15 ring-1 ring-emerald-900/10 backdrop-blur-sm'

/** Floating rose security card (overlaps media corner) */
export const heroRoseCard =
  'absolute -bottom-2 right-1/2 z-10 max-w-[min(calc(100vw-2.5rem),220px)] translate-x-1/2 -rotate-1 rounded-xl border border-rose-200/90 bg-gradient-to-br from-rose-50 to-rose-100/95 p-3.5 shadow-lg shadow-rose-900/15 sm:right-auto sm:translate-x-0 sm:-bottom-3 sm:-right-1 sm:max-w-[240px] sm:p-4 md:-bottom-4 md:-right-5 md:max-w-[280px] md:p-5 lg:-right-8'

/** Alternating section on cream */
export const surfaceMutedBand =
  'border-y border-emerald-900/10 bg-[#faf8f5] py-16 md:py-20'

/** Footer strip */
export const surfaceFooter = 'bg-emerald-950 text-emerald-50'

// ——— Layout ———

export const sectionContainer = 'mx-auto max-w-7xl px-3 sm:px-4 md:px-8'

export const sectionNarrow = 'mx-auto max-w-2xl text-center'

// ——— PublicLayout shell (auth, home, invitations — not `/`, which uses Landing’s header) ———

export const publicLayoutShell =
  'flex h-dvh min-h-0 flex-col overflow-hidden bg-[#faf8f5] text-emerald-950'

export const publicLayoutNavChrome =
  'z-10 shrink-0 border-b border-emerald-900/10 bg-[#faf8f5]/95 backdrop-blur-sm'

export const publicLayoutNavRow =
  'mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-3 py-4 sm:gap-4 sm:px-4 sm:py-5 md:px-8'

/** Guest CTA in layout chrome (outline on cream) */
export const publicNavCtaGuest =
  'rounded-lg border border-emerald-800/25 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 shadow-sm transition hover:border-emerald-800/40 hover:bg-emerald-50/90'

export const publicLayoutScrollMain =
  'min-h-0 flex-1 overflow-y-auto overscroll-y-contain'

// ——— Typography ———

export const headingHero =
  'text-[1.65rem] font-semibold leading-[1.12] tracking-tight text-emerald-950 sm:text-3xl md:text-4xl lg:text-5xl xl:text-[3.25rem]'

export const headingHeroAccent = 'text-emerald-800/90'

export const headingSection =
  'text-xl font-semibold tracking-tight text-emerald-950 sm:text-2xl md:text-3xl'

export const lead =
  'text-sm leading-relaxed text-stone-600 sm:text-base lg:text-lg'

export const bodyMuted = 'text-sm text-stone-500'

export const captionMuted = 'text-xs text-stone-500'

export const bodyMutedLg = 'text-stone-600'

export const statValue =
  'text-xl font-semibold text-emerald-900 sm:text-2xl'

export const statLabel = 'text-sm text-stone-500'

export const metricValue = 'font-medium text-emerald-900'

export const metricLabel = 'text-xs text-stone-500'

export const quote =
  'text-xl font-medium leading-relaxed text-emerald-950 md:text-2xl'

export const attributionName = 'text-sm font-semibold text-emerald-900'

export const logoWordmark = 'text-lg font-bold tracking-tight text-emerald-950'

// ——— Cards ———

export const cardElevated =
  'overflow-hidden rounded-2xl border border-white/80 bg-white/60 shadow-lg shadow-emerald-900/10 backdrop-blur-sm'

export const cardMediaPlaceholder =
  'relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-emerald-200/50 via-[#e8ede5] to-teal-100/60'

export const cardCaptionBar =
  'border-t border-emerald-900/5 bg-white/80 px-4 py-3'

export const cardCaptionTitle = 'text-sm font-medium text-emerald-900'

export const cardRoseFloat =
  'absolute -bottom-4 -right-2 max-w-[220px] rounded-xl border border-rose-200/80 bg-gradient-to-br from-rose-50 to-rose-100/90 p-4 shadow-md shadow-rose-900/10 md:-right-6'

export const roseIconBubble =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-200/60 text-rose-800'

export const roseTitle = 'text-sm font-semibold text-rose-950'

export const roseBody = 'mt-1 text-xs leading-snug text-rose-900/70'

export const opportunityCard =
  'flex h-full flex-col rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm shadow-emerald-900/5 transition hover:border-emerald-800/25 hover:shadow-md sm:p-6'

export const opportunityIconBubble =
  'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800'

export const opportunityMetricsRow = 'mt-5 grid grid-cols-2 gap-3'

export const opportunityMetricCell =
  'rounded-xl border border-emerald-900/10 bg-emerald-50/50 px-3 py-2.5'

export const cardTitle = 'font-semibold text-emerald-950'

export const testimonialImage =
  'aspect-square max-h-80 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-200/50 to-stone-200/60 md:max-h-none'

/** Step 7 — testimonial strip: square photo panel + copy */
export const testimonialSection =
  'border-y border-emerald-900/10 bg-[#faf8f5] py-12 sm:py-16 md:py-20 lg:py-24'

export const testimonialGrid =
  'grid gap-10 sm:gap-12 lg:grid-cols-2 lg:items-center lg:gap-16 xl:gap-20'

export const testimonialPhotoFrame =
  'relative mx-auto aspect-square w-full max-w-[min(100%,420px)] overflow-hidden rounded-2xl border border-emerald-900/10 bg-gradient-to-br from-emerald-100/90 via-[#eef3ec] to-teal-100/70 shadow-xl shadow-emerald-900/10 ring-1 ring-white/70 md:mx-0'

export const testimonialKicker =
  'text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800/80'

export const testimonialQuote =
  'relative text-lg font-medium leading-relaxed text-emerald-950 sm:text-xl lg:text-2xl lg:leading-snug'

// ——— Navigation & chrome ———

export const navLink =
  'text-sm font-medium text-emerald-900/70 transition hover:text-emerald-900'

export const iconButton =
  'rounded-full p-2 text-emerald-900/60 transition hover:bg-emerald-900/5 hover:text-emerald-900'

export const iconButtonSubtle =
  'rounded-full p-2 text-emerald-900/50 transition hover:bg-emerald-900/5 hover:text-emerald-900'

export const dividerSubtle = 'border-t border-emerald-900/10'

export const dividerFooter = 'border-t border-emerald-800/80'

// ——— Footer typography ———

export const footerBrand = 'text-lg font-bold text-white'

export const footerBody = 'mt-3 text-sm leading-relaxed text-emerald-100/80'

export const footerColTitle =
  'text-xs font-semibold uppercase tracking-wider text-emerald-400/90'

export const footerLinkList = 'mt-4 space-y-2 text-sm text-emerald-100/85'

export const footerLink = 'transition hover:text-white'

export const footerLegal = 'text-xs text-emerald-200/70'

export const footerSocialButton =
  'rounded-full p-2 text-emerald-200/80 transition hover:bg-emerald-900/50 hover:text-white'

export const footerSocialRow = 'flex flex-wrap items-center gap-2'

export const footerLegalLink =
  'text-xs text-emerald-200/70 underline-offset-2 transition hover:text-white hover:underline'

// ——— Buttons (public marketing — slightly deeper green than dashboard forms) ———

export const btnPrimary =
  'rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-900 disabled:opacity-50'

export const btnSecondary =
  'rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-100 disabled:opacity-50'

/** Outline that reads on sage/cream hero */
export const btnSecondaryOnHero = `${btnSecondary} border-emerald-900/15 text-emerald-900`

// ——— Auth page (split card) ———

export const authPageWrap =
  'flex min-h-full w-full flex-col items-center justify-center px-4 py-10 md:py-14'

export const authSplitCard =
  'flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-xl shadow-emerald-900/[0.12] sm:max-w-xl lg:max-w-5xl lg:min-h-[520px] lg:flex-row'

export const authBrandAside =
  'relative flex flex-col justify-between gap-6 overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 px-6 py-8 text-emerald-50 sm:gap-8 sm:px-8 sm:py-10 lg:w-[42%] lg:px-10 lg:py-12'

export const authFormSection =
  'flex flex-1 flex-col justify-center px-6 py-8 sm:px-8 sm:py-10 lg:px-11 lg:py-12'

export const authTabGroup = 'mb-6 flex rounded-xl bg-emerald-900/[0.06] p-1'

export const authTabActive =
  'flex-1 rounded-lg bg-white py-2.5 text-sm font-semibold text-emerald-900 shadow-sm'

export const authTabInactive =
  'flex-1 rounded-lg py-2.5 text-sm font-semibold text-emerald-800/65 transition hover:text-emerald-900'

/**
 * Public / marketing design tokens (Tailwind class strings).
 * Warm cream base, forest green primary, sage hero, rose accents.
 */

// ——— Surfaces ———

export const pageBg = 'bg-[#faf8f5]'

export const textOnPage = 'text-emerald-950'

export const landingPageShell = `min-h-screen ${pageBg} ${textOnPage} dark:bg-slate-950 dark:text-stone-100`

/** Sticky header on cream */
export const topNavBar =
  'sticky top-0 z-20 border-b border-emerald-900/10 bg-[#faf8f5]/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90'

/** Full-width sage / teal wash behind hero */
export const surfaceHero =
  'relative overflow-hidden bg-gradient-to-br from-emerald-50/90 via-[#f0f4ef] to-teal-50/80 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/40'

/** Hero: single column &lt; lg (1024px); two columns from lg — visual stacks first on tablets */
export const heroGrid =
  'relative grid w-full gap-10 py-12 md:py-16 lg:grid-cols-2 lg:items-center lg:gap-14 lg:py-20 xl:gap-16 xl:py-24'

/** Stat / progress strip under hero lead */
export const heroStatCluster =
  'mt-7 flex flex-wrap items-start gap-6 rounded-2xl border border-emerald-900/10 bg-white/50 px-4 py-3 shadow-sm shadow-emerald-900/[0.06] backdrop-blur-sm sm:mt-9 sm:gap-8 sm:px-5 sm:py-4 md:gap-10 dark:border-slate-700 dark:bg-slate-900/70'

/** Main hero visual (media card) — tinted glass panel */
export const heroMediaCard =
  'overflow-hidden rounded-2xl border border-white/90 bg-white/70 shadow-xl shadow-emerald-900/15 ring-1 ring-emerald-900/10 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80 dark:ring-slate-700'

/** Floating rose security card (overlaps media corner) */
export const heroRoseCard =
  'absolute -bottom-2 right-1/2 z-10 max-w-[min(calc(100vw-2.5rem),220px)] translate-x-1/2 -rotate-1 rounded-xl border border-rose-200/90 bg-gradient-to-br from-rose-50 to-rose-100/95 p-3.5 shadow-lg shadow-rose-900/15 sm:right-auto sm:translate-x-0 sm:-bottom-3 sm:-right-1 sm:max-w-[240px] sm:p-4 md:-bottom-4 md:-right-5 md:max-w-[280px] md:p-5 lg:-right-8 dark:border-rose-900/50 dark:from-slate-900 dark:to-slate-800 dark:shadow-slate-950/60'

/** Alternating section on cream */
export const surfaceMutedBand =
  'border-y border-emerald-900/10 bg-[#faf8f5] py-16 md:py-20'

/** Footer strip */
export const surfaceFooter = 'bg-emerald-950 text-emerald-50'

// ——— Layout ———

export const sectionContainer = 'mx-auto max-w-7xl px-3 sm:px-4 md:px-8'

export const sectionNarrow = 'mx-auto max-w-2xl text-center'

/**
 * Fixed-height top chrome (8rem). Logo uses max-h-full inside a stretch slot so changing
 * asset dimensions never grows or shrinks this bar.
 */
export const marketingNavInnerRow =
  'flex h-32 min-h-32 max-h-32 shrink-0 items-center justify-between gap-2 py-2.5 sm:gap-4'

// ——— PublicLayout shell (auth, home, invitations — not `/`, which uses Landing’s header) ———

export const publicLayoutShell =
  'flex h-dvh min-h-0 flex-col overflow-hidden bg-[#faf8f5] text-emerald-950 dark:bg-slate-950 dark:text-stone-100'

export const publicLayoutNavChrome =
  'z-10 shrink-0 border-b border-emerald-900/10 bg-[#faf8f5]/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95'

export const publicLayoutNavRow =
  'mx-auto flex h-32 min-h-32 max-h-32 w-full max-w-7xl shrink-0 items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 md:px-8'

/** Guest CTA in layout chrome (outline on cream) */
export const publicNavCtaGuest =
  'stkg-btn rounded-lg border border-emerald-800/25 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 shadow-sm transition hover:border-emerald-800/40 hover:bg-emerald-50/90 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-emerald-100 dark:hover:border-emerald-400/40 dark:hover:bg-slate-800'

export const publicLayoutScrollMain =
  'min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth'

// ——— Typography ———

export const headingHero =
  'text-[1.65rem] font-semibold leading-[1.12] tracking-tight text-emerald-950 sm:text-3xl md:text-4xl lg:text-5xl xl:text-[3.25rem] dark:text-stone-100'

export const headingHeroAccent = 'text-emerald-800/90 dark:text-emerald-300'

export const headingSection =
  'text-xl font-semibold tracking-tight text-emerald-950 sm:text-2xl md:text-3xl dark:text-stone-100'

export const lead =
  'text-sm leading-relaxed text-stone-600 sm:text-base lg:text-lg dark:text-stone-300'

export const bodyMuted = 'text-sm text-stone-500 dark:text-stone-400'

export const captionMuted = 'text-xs text-stone-500 dark:text-stone-400'

export const bodyMutedLg = 'text-stone-600 dark:text-stone-300'

export const statValue =
  'text-xl font-semibold text-emerald-900 sm:text-2xl dark:text-emerald-200'

export const statLabel = 'text-sm text-stone-500 dark:text-stone-400'

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
  'relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-emerald-200/50 via-[#e8ede5] to-teal-100/60 dark:from-slate-800 dark:via-slate-800 dark:to-emerald-900/40'

export const cardCaptionBar =
  'border-t border-emerald-900/5 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/80'

export const cardCaptionTitle = 'text-sm font-medium text-emerald-900 dark:text-emerald-200'

export const cardRoseFloat =
  'absolute -bottom-4 -right-2 max-w-[220px] rounded-xl border border-rose-200/80 bg-gradient-to-br from-rose-50 to-rose-100/90 p-4 shadow-md shadow-rose-900/10 md:-right-6'

export const roseIconBubble =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-200/60 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'

export const roseTitle = 'text-sm font-semibold text-rose-950 dark:text-rose-200'

export const roseBody = 'mt-1 text-xs leading-snug text-rose-900/70 dark:text-rose-200/80'

export const opportunityCard =
  'stkg-card flex h-full flex-col rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm shadow-emerald-900/5 outline-none transition duration-200 focus-within:ring-2 focus-within:ring-emerald-600/30 focus-within:ring-offset-2 focus-within:ring-offset-[#faf8f5] sm:p-6 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:ring-offset-slate-950'

export const opportunityIconBubble =
  'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'

export const opportunityMetricsRow = 'mt-5 grid grid-cols-2 gap-3'

export const opportunityMetricCell =
  'rounded-xl border border-emerald-900/10 bg-emerald-50/50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/60'

export const cardTitle = 'font-semibold text-emerald-950 dark:text-stone-100'

export const testimonialImage =
  'aspect-square max-h-80 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-200/50 to-stone-200/60 md:max-h-none'

/** Step 7 — testimonial strip: square photo panel + copy */
export const testimonialSection =
  'border-y border-emerald-900/10 bg-[#faf8f5] py-12 sm:py-16 md:py-20 lg:py-24 dark:border-slate-800 dark:bg-slate-950'

export const testimonialGrid =
  'grid gap-10 sm:gap-12 lg:grid-cols-2 lg:items-center lg:gap-16 xl:gap-20'

export const testimonialPhotoFrame =
  'relative mx-auto aspect-square w-full max-w-[min(100%,420px)] overflow-hidden rounded-2xl border border-emerald-900/10 bg-gradient-to-br from-emerald-100/90 via-[#eef3ec] to-teal-100/70 shadow-xl shadow-emerald-900/10 ring-1 ring-white/70 md:mx-0 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-emerald-900/40 dark:ring-slate-700'

export const testimonialKicker =
  'text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800/80 dark:text-emerald-300/80'

export const testimonialQuote =
  'relative text-lg font-medium leading-relaxed text-emerald-950 sm:text-xl lg:text-2xl lg:leading-snug dark:text-stone-100'

// ——— Navigation & chrome ———

export const navLink =
  'stkg-nav-link text-sm font-medium text-emerald-900/70 transition hover:text-emerald-900 dark:text-emerald-200/75 dark:hover:text-emerald-100'

export const iconButton =
  'stkg-btn rounded-full p-2 text-emerald-900/60 transition hover:bg-emerald-900/5 hover:text-emerald-900 dark:text-emerald-200/70 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-100'

export const iconButtonSubtle =
  'stkg-btn rounded-full p-2 text-emerald-900/50 transition hover:bg-emerald-900/5 hover:text-emerald-900'

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
  'stkg-btn rounded-full p-2 text-emerald-200/80 transition hover:bg-emerald-900/50 hover:text-white'

export const footerSocialRow = 'flex flex-wrap items-center gap-2'

export const footerLegalLink =
  'text-xs text-emerald-200/70 underline-offset-2 transition hover:text-white hover:underline'

// ——— Buttons (public marketing — slightly deeper green than dashboard forms) ———

export const btnPrimary =
  'stkg-btn rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-900 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500'

export const btnSecondary =
  'stkg-btn rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-stone-200 dark:hover:bg-slate-700'

/** Outline that reads on sage/cream hero */
export const btnSecondaryOnHero = `${btnSecondary} border-emerald-900/15 text-emerald-900`

// ——— Auth page (split card) ———

export const authPageWrap =
  'flex min-h-full w-full flex-1 flex-col items-center justify-center px-4 py-8 sm:py-10 md:py-12'

export const authSplitCard =
  'flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-xl shadow-emerald-900/[0.12] sm:max-w-xl lg:max-w-5xl lg:min-h-[520px] lg:flex-row dark:border-slate-700 dark:bg-slate-900'

export const authBrandAside =
  'relative flex flex-col items-center justify-between gap-6 overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 px-6 py-8 text-center text-emerald-50 sm:gap-8 sm:px-8 sm:py-10 lg:w-[42%] lg:px-10 lg:py-12'

export const authFormSection =
  'flex flex-1 flex-col justify-center px-6 py-8 sm:px-8 sm:py-10 lg:px-11 lg:py-12 dark:bg-slate-900'

export const authTabGroup =
  'mb-6 flex rounded-xl bg-emerald-900/[0.06] p-1 dark:bg-emerald-500/10'

export const authTabActive =
  'stkg-btn flex-1 rounded-lg bg-white py-2.5 text-sm font-semibold text-emerald-900 shadow-sm dark:bg-slate-800 dark:text-emerald-100'

export const authTabInactive =
  'stkg-btn flex-1 rounded-lg py-2.5 text-sm font-semibold text-emerald-800/65 transition hover:text-emerald-900 dark:text-emerald-300/70 dark:hover:text-emerald-100'

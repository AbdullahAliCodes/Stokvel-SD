import { useLayoutEffect, useRef } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import PublicFooter from '../components/PublicFooter'
import { useSession } from '../context/SessionContext'
import { supabase } from '../utils/supabase'
import {
  btnPrimary,
  btnSecondary,
  publicLayoutNavChrome,
  publicLayoutNavRow,
  publicLayoutScrollMain,
  publicLayoutShell,
  publicNavCtaGuest,
} from '../styles/tokens'

export default function PublicLayout() {
  const navigate = useNavigate()
  const { session, userRole } = useSession()
  const isAdmin = String(userRole || '').toLowerCase() === 'admin'
  const { pathname } = useLocation()
  const scrollMainRef = useRef(null)
  const landingHasOwnNav = pathname === '/'
  const showPublicFooter = !landingHasOwnNav && pathname !== '/auth'

  useLayoutEffect(() => {
    const el = scrollMainRef.current
    if (el) el.scrollTop = 0
  }, [pathname])

  return (
    <div className={publicLayoutShell}>
      {!landingHasOwnNav && (
        <header className={publicLayoutNavChrome}>
          <div className={publicLayoutNavRow}>
            <div className="flex min-h-0 max-h-full min-w-0 shrink-0 self-stretch items-center">
              <BrandLogo
                to={session && isAdmin ? '/admin/groups' : '/'}
                className="h-full min-h-0 max-h-full"
                imgClassName="max-h-full w-auto max-w-[min(58vw,360px)] object-contain object-left sm:max-w-[min(50vw,400px)] md:max-w-[min(44vw,440px)]"
              />
            </div>
            {!session ? (
              <Link to="/auth" className={publicNavCtaGuest}>
                Log In / Sign Up
              </Link>
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className={`${btnSecondary} border-emerald-800/20 px-4 py-2.5 text-sm font-semibold text-emerald-900`}
                  onClick={async () => {
                    await supabase.auth.signOut()
                    navigate('/', { replace: true })
                  }}
                >
                  Log out
                </button>
                <Link
                  to={isAdmin ? '/admin/groups' : '/dashboard'}
                  className={`${btnPrimary} px-4 py-2.5 text-sm font-semibold`}
                >
                  {isAdmin ? 'Admin Dashboard' : 'Dashboard'}
                </Link>
              </div>
            )}
          </div>
        </header>
      )}
      <div ref={scrollMainRef} className={publicLayoutScrollMain}>
        <div className="flex min-h-full flex-col">
          <div className="flex-1">
            <Outlet />
          </div>
          {showPublicFooter ? <PublicFooter /> : null}
        </div>
      </div>
    </div>
  )
}

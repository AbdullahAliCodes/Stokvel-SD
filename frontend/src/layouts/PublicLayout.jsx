import { Link, Outlet, useLocation } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import { useSession } from '../context/SessionContext'
import {
  btnPrimary,
  publicLayoutNavChrome,
  publicLayoutNavRow,
  publicLayoutScrollMain,
  publicLayoutShell,
  publicNavCtaGuest,
} from '../styles/tokens'

export default function PublicLayout() {
  const { session, userRole } = useSession()
  const isAdmin = String(userRole || '').toLowerCase() === 'admin'
  const { pathname } = useLocation()
  const landingHasOwnNav = pathname === '/'

  return (
    <div className={publicLayoutShell}>
      {!landingHasOwnNav && (
        <header className={publicLayoutNavChrome}>
          <div className={publicLayoutNavRow}>
            <BrandLogo
              to={!session ? '/' : isAdmin ? '/admin/groups' : '/home'}
              imgClassName="h-24 w-auto sm:h-28 md:h-32 lg:h-40 xl:h-44"
            />
            {!session ? (
              <Link to="/auth" className={publicNavCtaGuest}>
                Log In / Sign Up
              </Link>
            ) : (
              <Link
                to={isAdmin ? '/admin/groups' : '/dashboard'}
                className={`${btnPrimary} px-4 py-2.5 text-sm font-semibold`}
              >
                {isAdmin ? 'Admin Dashboard' : 'Dashboard'}
              </Link>
            )}
          </div>
        </header>
      )}
      <div className={publicLayoutScrollMain}>
        <Outlet />
      </div>
    </div>
  )
}

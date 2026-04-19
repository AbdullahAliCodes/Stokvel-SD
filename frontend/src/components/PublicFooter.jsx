import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import {
  dividerFooter,
  footerBody,
  footerColTitle,
  footerLegal,
  footerLegalLink,
  footerLink,
  footerLinkList,
  sectionContainer,
  surfaceFooter,
} from '../styles/tokens'

/** Marketing footer for cream public shell (Home, /stokvels, etc.). Deep links use landing anchors on `/`. */
export default function PublicFooter() {
  return (
    <footer className={`${surfaceFooter} mt-auto`}>
      <div className={`${sectionContainer} py-12 md:py-16`}>
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-10 lg:grid-cols-3 lg:gap-12">
          <div className="min-w-0">
            <BrandLogo to="/" variant="onDark" imgClassName="h-12 w-auto sm:h-14 md:h-16" />
            <p className={footerBody}>
              Community-first savings circles with transparent tools for members and admins.
            </p>
          </div>
          <nav aria-label="Company" className="min-w-0">
            <p className={footerColTitle}>Company</p>
            <ul className={footerLinkList}>
              <li>
                <Link to="/#how" className={footerLink}>
                  How it works
                </Link>
              </li>
              <li>
                <Link to="/auth" className={footerLink}>
                  Create account
                </Link>
              </li>
              <li>
                <Link to="/#footer-support" className={footerLink}>
                  Contact
                </Link>
              </li>
            </ul>
          </nav>
          <nav id="footer-support" aria-label="Support" className="min-w-0 scroll-mt-24">
            <p className={footerColTitle}>Support</p>
            <ul className={footerLinkList}>
              <li>
                <Link to="/auth" className={footerLink}>
                  Help centre (sign in)
                </Link>
              </li>
              <li>
                <Link to="/stokvels" className={footerLink}>
                  Browse groups
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className={`mt-12 flex flex-col gap-6 ${dividerFooter} pt-8`}>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
            <p className={`${footerLegal} shrink-0`}>
              © {new Date().getFullYear()} StokGeld. All rights reserved.
            </p>
            <nav className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legal">
              <a href="#privacy" className={footerLegalLink}>
                Privacy
              </a>
              <a href="#terms" className={footerLegalLink}>
                Terms
              </a>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  )
}

import { Outlet } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

export default function RequireMember() {
  const { userRole } = useSession()

  if (userRole === null || userRole === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F5F0] p-8 text-stone-600">
        Loading your dashboard...
      </div>
    )
  }

  return <Outlet />
}

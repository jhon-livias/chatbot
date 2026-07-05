import { useAuth } from '../auth/AuthContext'
import DashboardPage from '../pages/DashboardPage'

/** Remounts dashboard when auth session changes (e.g. right after login). */
export default function DashboardShell() {
  const { sessionKey } = useAuth()
  return <DashboardPage key={sessionKey} />
}

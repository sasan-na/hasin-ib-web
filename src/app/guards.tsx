import {Navigate, Outlet, useLocation} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {useSession} from "@/store/session"

// The session lives in memory only, so a refresh lands here and sends the user to login.
export function RequireAuth() {
	const signedIn = useSession((s) => s.token !== null)
	const mustChangePassword = useSession((s) => s.mustChangePassword)
	const {pathname} = useLocation()
	if (!signedIn) return <Navigate to={routeMap.login.path} replace/>
	// A user whose password must change can reach nothing but the change-password page.
	if (mustChangePassword && pathname !== routeMap.changePassword.path) {
		return <Navigate to={routeMap.changePassword.path} replace/>
	}
	return <Outlet/>
}

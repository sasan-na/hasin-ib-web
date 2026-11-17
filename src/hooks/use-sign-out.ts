import {logoutRequest} from "@/lib/api/client"
import {logger} from "@/lib/logger"
import {useSession} from "@/store/session"

/** Ends the server session, then drops the in-memory one. The route guard sends the user to login. */
export function useSignOut() {
	const signOut = useSession((s) => s.signOut)

	return async () => {
		try {
			await logoutRequest()
		} catch (error) {
			// The local session is dropped either way: a failed call must not keep the user signed in.
			logger.warn("logout request failed", {error: String(error)})
		}
		signOut()
	}
}

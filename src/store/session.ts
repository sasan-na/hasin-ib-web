import {create} from "zustand"

// Memory-only session: nothing is persisted, so a refresh signs the user out and no script or later
// visitor of this browser can read the token from web storage. apiClient sends it as `Authorization`.
interface SessionState {
	username: string | null
	token: string | null
	/** True when the server ended the session (as opposed to the user signing out): the login page says so. */
	expired: boolean
	/** True while the server requires a new password: the route guard keeps the user on the change-password page. */
	mustChangePassword: boolean
	signIn: (username: string, token: string, mustChangePassword?: boolean) => void
	signOut: () => void
	expireSession: () => void
	requirePasswordChange: () => void
	passwordChanged: () => void
}

export const useSession = create<SessionState>()((set) => ({
	username: null,
	token: null,
	expired: false,
	mustChangePassword: false,
	signIn: (username, token, mustChangePassword = false) => set({username, token, expired: false, mustChangePassword}),
	signOut: () => set({username: null, token: null, expired: false, mustChangePassword: false}),
	expireSession: () => set({username: null, token: null, expired: true, mustChangePassword: false}),
	requirePasswordChange: () => set({mustChangePassword: true}),
	passwordChanged: () => set({mustChangePassword: false}),
}))


import {create} from "zustand"

// Memory-only session: nothing is persisted, so a refresh signs the user out and no script or later
// visitor of this browser can read the token from web storage. apiClient sends it as `Authorization`.
interface SessionState {
	username: string | null
	token: string | null
	/** True when the server ended the session (as opposed to the user signing out): the login page says so. */
	expired: boolean
	signIn: (username: string, token: string) => void
	signOut: () => void
	expireSession: () => void
}

export const useSession = create<SessionState>()((set) => ({
	username: null,
	token: null,
	expired: false,
	signIn: (username, token) => set({username, token, expired: false}),
	signOut: () => set({username: null, token: null, expired: false}),
	expireSession: () => set({username: null, token: null, expired: true}),
}))


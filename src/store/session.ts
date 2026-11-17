import {create} from "zustand"

// Memory-only session: nothing is persisted, so a refresh signs the user out and no script or later
// visitor of this browser can read the token from web storage. apiClient sends it as `Authorization`.
interface SessionState {
	username: string | null
	token: string | null
	signIn: (username: string, token: string) => void
	signOut: () => void
}

export const useSession = create<SessionState>()((set) => ({
	username: null,
	token: null,
	signIn: (username, token) => set({username, token}),
	signOut: () => set({username: null, token: null}),
}))


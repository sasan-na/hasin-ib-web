import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

// The session lives in sessionStorage so a reload keeps the user signed in. It is scoped to the tab and gone when the
// tab closes, and signing out or an expired session clears it. apiClient sends the token as `Authorization`.
interface SessionState {
	username: string | null
	token: string | null
	/** True when the server ended the session (as opposed to the user signing out): the login page says so. */
	expired: boolean
	/** True while the server requires a new password: the route guard keeps the user on the change-password page. */
	mustChangePassword: boolean
	signIn: (
		username: string,
		token: string,
		mustChangePassword?: boolean,
	) => void
	signOut: () => void
	expireSession: () => void
	requirePasswordChange: () => void
	passwordChanged: () => void
}

export const useSession = create<SessionState>()(
	persist(
		(set) => ({
			username: null,
			token: null,
			expired: false,
			mustChangePassword: false,
			signIn: (username, token, mustChangePassword = false) =>
				set({ username, token, expired: false, mustChangePassword }),
			signOut: () =>
				set({
					username: null,
					token: null,
					expired: false,
					mustChangePassword: false,
				}),
			expireSession: () =>
				set({
					username: null,
					token: null,
					expired: true,
					mustChangePassword: false,
				}),
			requirePasswordChange: () => set({ mustChangePassword: true }),
			passwordChanged: () => set({ mustChangePassword: false }),
		}),
		{
			name: "ibn-session",
			storage: createJSONStorage(() => sessionStorage),
			partialize: ({ username, token, mustChangePassword }) => ({
				username,
				token,
				mustChangePassword,
			}),
		},
	),
)

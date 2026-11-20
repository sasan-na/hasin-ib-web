import {create} from "zustand"

const KEY = "hide-balances"

const read = (): boolean => {
	try {
		return sessionStorage.getItem(KEY) === "1"
	} catch {
		return false
	}
}

interface PrivacyState {
	hidden: boolean
	toggle: () => void
}

/** Whether amounts on screen are masked; one switch for the whole home page, kept for this tab only. */
export const usePrivacyStore = create<PrivacyState>()((set, get) => ({
	hidden: read(),
	toggle: () => {
		const hidden = !get().hidden
		try {
			sessionStorage.setItem(KEY, hidden ? "1" : "0")
		} catch {
			// Storage blocked: the choice just lasts until reload.
		}
		set({hidden})
	},
}))

export const MASK = "••••••••"

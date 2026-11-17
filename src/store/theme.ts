import {create} from "zustand"

export type Theme = "light" | "dark" | "system"

/** Same key as `public/theme-boot.js`, which applies the stored choice before first paint. */
export const THEME_STORAGE_KEY = "vite-ui-theme"

const isTheme = (value: unknown): value is Theme => value === "light" || value === "dark" || value === "system"

const readStoredTheme = (): Theme => {
	try {
		const stored = localStorage.getItem(THEME_STORAGE_KEY)
		return isTheme(stored) ? stored : "system"
	} catch {
		// Storage blocked: the choice just lasts for this visit.
		return "system"
	}
}

interface ThemeState {
	theme: Theme
	setTheme: (theme: Theme) => void
}

// The choice (light, dark or system) is a harmless preference, so it is kept in localStorage.
// It is the user's *choice* that is stored, so "system" keeps following the OS.
export const useThemeStore = create<ThemeState>()((set) => ({
	theme: readStoredTheme(),
	setTheme: (theme) => {
		try {
			localStorage.setItem(THEME_STORAGE_KEY, theme)
		} catch {
			/* storage blocked: the choice is not remembered */
		}
		set({theme})
	},
}))

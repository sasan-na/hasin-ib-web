import {useEffect} from "react"

import {useThemeStore} from "@/store/theme"

const DARK_QUERY = "(prefers-color-scheme: dark)"

/** Keeps the `dark` class on <html> in step with the chosen theme (and the OS, while it is "system"). */
export default function useSelectTheme(): void {
	const theme = useThemeStore((s) => s.theme)

	useEffect(() => {
		const root = document.documentElement
		const media = window.matchMedia(DARK_QUERY)
		const apply = () => root.classList.toggle("dark", theme === "dark" || (theme === "system" && media.matches))

		apply()
		if (theme !== "system") return
		media.addEventListener("change", apply)
		return () => media.removeEventListener("change", apply)
	}, [theme])
}

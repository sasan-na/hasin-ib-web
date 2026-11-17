/*
 * Runs from <head> before first paint (external file so a strict CSP needs no 'unsafe-inline').
 * Applies the stored theme class and the stored language's lang/dir so the page never flashes
 * the wrong theme or direction. Keys mirror src/hooks/useSelectTheme.ts ("vite-ui-theme") and
 * src/lib/i18n ("i18nextLng"); i18n init corrects anything else after mount.
 */
(function () {
	try {
		var stored = window.localStorage.getItem("vite-ui-theme")
		var dark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches)
		document.documentElement.classList.toggle("dark", dark)

		var directions = {fa: "rtl", en: "ltr"}
		var language = (window.localStorage.getItem("i18nextLng") || "").split("-")[0]
		if (Object.prototype.hasOwnProperty.call(directions, language)) {
			document.documentElement.lang = language
			document.documentElement.dir = directions[language]
		}
	} catch (e) {
		/* storage blocked: the app decides after mount */
	}
})()

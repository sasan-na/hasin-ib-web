import i18next from "i18next"
import {initReactI18next} from "react-i18next"

import enCommon from "@/locales/en/common.json"
import enErrors from "@/locales/en/errors.json"
import faCommon from "@/locales/fa/common.json"
import faErrors from "@/locales/fa/errors.json"

export const SUPPORTED_LANGUAGES = ["fa", "en"] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: SupportedLanguage = "fa"
export const LANGUAGE_STORAGE_KEY = "i18nextLng"

export const LANGUAGE_DIRECTIONS: Record<SupportedLanguage, "rtl" | "ltr"> = {fa: "rtl", en: "ltr"}

// Each language names itself in its own script so a user can always find theirs.
export const LANGUAGE_NATIVE_NAMES: Record<SupportedLanguage, string> = {fa: "فارسی", en: "English"}

export const resources = {
	fa: {common: faCommon, errors: faErrors},
	en: {common: enCommon, errors: enErrors},
} as const

const toSupported = (lng: string | null | undefined): SupportedLanguage => {
	const base = (lng ?? "").split("-")[0]
	return (SUPPORTED_LANGUAGES as readonly string[]).includes(base) ? (base as SupportedLanguage) : DEFAULT_LANGUAGE
}

function readStoredLanguage(): SupportedLanguage {
	try {
		return toSupported(window.localStorage.getItem(LANGUAGE_STORAGE_KEY))
	} catch {
		return DEFAULT_LANGUAGE
	}
}

// Keep <html lang dir> in step with the active language (CSS and assistive tech read both).
function applyDocumentLanguage(lng: string) {
	const language = toSupported(lng)
	document.documentElement.lang = language
	document.documentElement.dir = LANGUAGE_DIRECTIONS[language]
}

void i18next.use(initReactI18next).init({
	resources,
	lng: readStoredLanguage(),
	fallbackLng: {default: [DEFAULT_LANGUAGE], fa: ["en"]},
	supportedLngs: SUPPORTED_LANGUAGES,
	defaultNS: "common",
	ns: ["common", "errors"],
	interpolation: {escapeValue: false},
	react: {useSuspense: false},
})

applyDocumentLanguage(i18next.language)

i18next.on("languageChanged", (lng) => {
	applyDocumentLanguage(lng)
	try {
		window.localStorage.setItem(LANGUAGE_STORAGE_KEY, toSupported(lng))
	} catch {
		/* storage blocked: the choice just won't persist */
	}
})

export default i18next

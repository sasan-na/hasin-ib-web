import {normalizeDigits} from "@/lib/auth/normalizeDigits"

// The bank's core system takes dates in the Persian (Jalali) calendar as "YYYY/MM/DD", whatever the UI language.

const PARTS = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {year: "numeric", month: "2-digit", day: "2-digit"})

/** Today in the Persian calendar, as "YYYY/MM/DD". */
export const todayJalali = (): string => {
	const parts = Object.fromEntries(PARTS.formatToParts(new Date()).map((part) => [part.type, part.value]))
	return `${parts.year}/${parts.month}/${parts.day}`
}

/** Months 1-6 have 31 days; 7-12 have 30 (the last has 29 outside leap years, which is not checked here). */
const maxDay = (month: number): number => (month <= 6 ? 31 : 30)

/**
 * A date typed as 1404/5/9, ١۴٠۴-۰۵-۰۹ and so on, as the canonical "YYYY/MM/DD"; null when it is not a plausible
 * Persian date. The bank has the last word on leap-year edge cases.
 */
export const parseJalali = (text: string): string | null => {
	const match = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(normalizeDigits(text).trim())
	if (!match) return null
	const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
	if (year < 1300 || year > 1500 || month < 1 || month > 12 || day < 1 || day > maxDay(month)) return null
	return `${match[1]}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`
}

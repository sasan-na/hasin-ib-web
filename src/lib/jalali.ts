import {normalizeDigits} from "@/lib/normalize-digits"

// Users enter dates in the Persian (Jalali) calendar as "YYYY/MM/DD", whatever the UI language, and some of the
// bank's services take them that way as-is. Others want a calendar date, which `jalaliToIso` gives.

const FORMAT = {year: "numeric", month: "2-digit", day: "2-digit"} as const
const LOCAL = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", FORMAT)
const UTC = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {...FORMAT, timeZone: "UTC"})

const partsOf = (formatter: Intl.DateTimeFormat, date: Date): {year: number; month: number; day: number} => {
	const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
	return {year: Number(parts.year), month: Number(parts.month), day: Number(parts.day)}
}

const pad = (value: number): string => String(value).padStart(2, "0")

/** A date in the Persian calendar, as "YYYY/MM/DD" (in the user's time zone). */
export const formatJalali = (date: Date): string => {
	const {year, month, day} = partsOf(LOCAL, date)
	return `${year}/${pad(month)}/${pad(day)}`
}

export const todayJalali = (): string => formatJalali(new Date())

/** The day `days` before today, as "YYYY/MM/DD" in the Persian calendar. */
export const daysAgoJalali = (days: number): string => formatJalali(new Date(Date.now() - days * 86_400_000))

/** Months 1-6 have 31 days; 7-12 have 30 (the last has 29 outside leap years, which is not checked here). */
const maxDay = (month: number): number => (month <= 6 ? 31 : 30)

/**
 * A date typed as 1404/5/9, ١۴٠۴-۰۵-۰۹ and so on, as the canonical "YYYY/MM/DD"; null when it is not a plausible
 * Persian date. Leap-year edge cases are caught by `jalaliToIso`, which returns null for a day that does not exist.
 */
export const parseJalali = (text: string): string | null => {
	const match = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(normalizeDigits(text).trim())
	if (!match) return null
	const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
	if (year < 1300 || year > 1500 || month < 1 || month > 12 || day < 1 || day > maxDay(month)) return null
	return `${match[1]}/${pad(month)}/${pad(day)}`
}

/**
 * The calendar date ("YYYY-MM-DD") of a canonical Persian date ("YYYY/MM/DD"), or null when no such day exists.
 * The browser can only turn a date into its Persian form, so this walks the days of the matching year and asks it
 * which one is which; that is exact, and cheap enough for a form submit.
 */
export const jalaliToIso = (jalali: string): string | null => {
	const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(jalali)
	if (!match) return null
	const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
	// Farvardin 1 falls on 20-21 March of year + 621, so start on 1 March and walk forward past a full year.
	const start = Date.UTC(year + 621, 2, 1, 12)
	for (let offset = 0; offset <= 400; offset++) {
		const date = new Date(start + offset * 86_400_000)
		const found = partsOf(UTC, date)
		if (found.year === year && found.month === month && found.day === day) return date.toISOString().slice(0, 10)
	}
	return null
}

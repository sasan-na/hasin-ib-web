/** Locale for number formatting: Persian digits and separators in Persian, Western ones in English. */
const localeOf = (language: string): string => (language === "en" ? "en-US" : "fa-IR")

export const formatAmount = (value: number, language: string): string =>
	new Intl.NumberFormat(localeOf(language), {maximumFractionDigits: 0}).format(value)

/** `IR` plus the digits. The server may send the IBAN with or without the `IR` prefix. */
export const normalizeIban = (iban: string): string => {
	const compact = iban.replace(/\s+/g, "").toUpperCase()
	return /^[A-Z]{2}/.test(compact) ? compact : `IR${compact}`
}

/** The IBAN in groups of four characters. */
export const formatIban = (iban: string): string => normalizeIban(iban).replace(/(.{4})/g, "$1 ").trim()

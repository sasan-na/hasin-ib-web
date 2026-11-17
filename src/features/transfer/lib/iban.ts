/** The bank code inside an IBAN of 24 digits (after the two check digits). */
export const bankCodeOf = (iban: string): string => iban.slice(2, 5)

/** The code of Maskan itself; transfers to our own accounts go through the account transfer, not Paya or Satna. */
export const MASKAN_BANK_CODE = "014"

/** Whether an Iranian IBAN ("IR" plus 24 digits, the "IR" optional here) passes the ISO 7064 mod 97 check. */
export const isValidIban = (iban: string): boolean => {
	if (!/^\d{24}$/.test(iban)) return false
	// Move "IR" + check digits to the end, with I=18 and R=27: 1827 followed by the check digits.
	const rearranged = `${iban.slice(2)}1827${iban.slice(0, 2)}`
	let remainder = 0
	for (const digit of rearranged) remainder = (remainder * 10 + Number(digit)) % 97
	return remainder === 1
}

/** The kinds of utility bill, told apart by the digit before the check digit of the bill id. */
export type BillKind = "water" | "electricity" | "gas" | "phone" | "mobile" | "municipality" | "other"

const KINDS: Record<string, BillKind> = {"1": "water", "2": "electricity", "3": "gas", "4": "phone", "5": "mobile", "6": "municipality", "7": "municipality", "9": "other"}

/** The check digit for a run of digits (weights 2..7 from the right, modulo 11): the national bill-code rule. */
const checkDigit = (digits: string): number => {
	let sum = 0
	let weight = 2
	for (let index = digits.length - 1; index >= 0; index--) {
		if (weight === 8) weight = 2
		sum += Number(digits[index]) * weight
		weight++
	}
	sum %= 11
	return sum < 2 ? 0 : 11 - sum
}

const strip = (value: string): string => value.replace(/^0+/, "")

/** The kind of bill a bill id belongs to, or null when the id does not name a known kind. */
export const billKindOf = (billId: string): BillKind | null => {
	const id = strip(billId)
	return id.length < 6 ? null : (KINDS[id.charAt(id.length - 2)] ?? null)
}

export const isBillIdValid = (billId: string): boolean => {
	const id = strip(billId)
	return /^\d{6,}$/.test(id) && Number(id.slice(-1)) === checkDigit(id.slice(0, -1)) && billKindOf(billId) !== null
}

/** Both check digits of a payment id; the second one also covers the bill id. */
export const isPayIdValid = (payId: string, billId: string): boolean => {
	const pay = strip(payId)
	const bill = strip(billId)
	if (!/^\d{6,}$/.test(pay) || !/^\d+$/.test(bill)) return false
	const first = pay.slice(-2, -1)
	const second = pay.slice(-1)
	const body = pay.slice(0, -2)
	return checkDigit(body) === Number(first) && checkDigit(`${bill}${body}${first}`) === Number(second)
}

/** The amount in Rials written into a payment id: all but the last five digits, in thousands of Rials. */
export const amountOfPayId = (payId: string): number => {
	const pay = strip(payId)
	return Number(pay.slice(0, -5) || "0") * 1000
}

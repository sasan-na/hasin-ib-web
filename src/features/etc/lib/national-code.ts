/** Whether a string is a valid Iranian national code (ten digits whose last is a check digit). */
export const isNationalCode = (value: string): boolean => {
	if (!/^\d{10}$/.test(value) || /^(\d)\1{9}$/.test(value)) return false
	const digits = [...value].map(Number)
	const sum = digits.slice(0, 9).reduce((total, digit, index) => total + digit * (10 - index), 0)
	const remainder = sum % 11
	return remainder < 2 ? digits[9] === remainder : digits[9] === 11 - remainder
}

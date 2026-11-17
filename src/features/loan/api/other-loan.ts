import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import type {Loan} from "@/features/loan/api/loan"

const text = z.union([z.string(), z.number()]).nullish()

const num = (value: string | number | null | undefined): number | null => {
	if (value === null || value === undefined || value === "") return null
	const parsed = Number(String(value).replace(/,/g, ""))
	return Number.isFinite(parsed) ? parsed : null
}

/**
 * Whether a loan number is a loan card (and so is asked about as a card) rather than an account. The bank issues
 * loan cards from two number ranges, minus one block of savings-box cards; this is the legacy rule.
 */
export const isLoanCardNumber = (value: string): boolean => {
	if (value.startsWith("62802370") || value.startsWith("62802380")) return value < "6280237094200000" || value > "6280237098299999"
	return false
}

/** What the bank accepts as a loan number: an account number or a 16-digit card number. */
export const isLoanNumber = (value: string): boolean => (/^\d{16}$/.test(value) ? true : /^\d{10,22}$/.test(value))

const statusSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	isOtherLoan: z.boolean().nullish(),
	accountNumber: z.string().nullish(),
	cardNumber: z.string().nullish(),
	firstName: z.string().nullish(),
	familyName: z.string().nullish(),
	accountTypeTitle: z.string().nullish(),
	accountStatusTitle: z.string().nullish(),
	amount: text,
	totalRemain: text,
	delayRemain: text,
	penalty: text,
	allLoanCount: text,
	payLoanCount: text,
	firstLoanDate: z.string().nullish(),
	nextLoanDate: z.string().nullish(),
})

/** Looks up a loan by its account or card number, whoever it belongs to. Nothing is changed. */
export const lookupLoan = async (number: string): Promise<Loan> => {
	const onCard = isLoanCardNumber(number)
	const data = statusSchema.parse(
		camelKeys(
			await apiClient<unknown>(onCard ? "/CardInfo/GetCardStatus" : "/AccountInfo/GetAccountStatus", {
				method: "POST",
				body: JSON.stringify(onCard ? {cardPan: number} : {accountNumber: number}),
			}),
		),
	)
	if (data.isSuccessful === false) throw new Error(data.message ?? "loan lookup failed")
	return {
		accountNumber: data.accountNumber ?? "",
		cardNumber: data.cardNumber ?? "",
		holder: [data.firstName, data.familyName].filter(Boolean).join(" "),
		title: data.accountTypeTitle ?? "",
		typeName: data.accountStatusTitle ?? "",
		nextDueDate: data.nextLoanDate ?? "",
		installment: num(data.amount),
		remaining: num(data.totalRemain),
		penalty: num(data.penalty),
		overdue: num(data.delayRemain),
		paidCount: num(data.payLoanCount),
		totalCount: num(data.allLoanCount),
		firstDate: data.firstLoanDate ?? "",
		isOther: data.isOtherLoan === true,
		onCard,
		payable: true,
		error: "",
	}
}

const deleteSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish()})

/** Stops following a loan of someone else: it leaves the user's list. The loan itself is not touched. */
export const unfollowLoan = async (loan: Pick<Loan, "onCard" | "cardNumber" | "accountNumber">): Promise<string> => {
	const data = deleteSchema.parse(
		camelKeys(
			await apiClient<unknown>("/BatchLoanStatus/DeleteOtherLoan", {
				method: "POST",
				body: JSON.stringify({isAccount: !loan.onCard, pan: loan.onCard ? loan.cardNumber : loan.accountNumber}),
			}),
		),
	)
	if (data.isSuccessful === false) throw new Error(data.message ?? "unfollow failed")
	return data.message ?? ""
}

import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toTransactionResult, type PasswordType, type TransactionResult} from "@/features/transaction/api/transaction"
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

export interface BatchLoanItem {
	/** The loan's account or card number. */
	number: string
	/** In Rials. */
	amount: number
	holder: string
	reasonCode: string
}

export interface BatchLoanRequest {
	sourceAccountNumber: string
	sourcePassword: string | null
	sourcePasswordType: PasswordType
	items: BatchLoanItem[]
	documentDescription: string
	/** Also add the loans to the user's list of loans they follow. */
	follow: boolean
}

/**
 * Pays installments of several loans from one account in a single batch. A real transaction: send once per
 * confirmation, never retry automatically.
 */
export const payBatchLoan = (request: BatchLoanRequest): Promise<TransactionResult> =>
	apiClient<unknown>("/AccountBatchInstallment/PayBatchLoan", {
		method: "POST",
		body: JSON.stringify({
			sourceAccountInfo: {
				accountNumber: request.sourceAccountNumber,
				...(request.sourcePassword ? {accountPin: request.sourcePassword} : {}),
				passwordType: request.sourcePasswordType,
			},
			loanItems: request.items.map((item) => ({destinationNumber: item.number, amount: item.amount, firstName: item.holder, familyName: "", reasonCode: item.reasonCode})),
			isRepetitive: request.follow,
			documentDescription: request.documentDescription,
		}),
	}).then(toTransactionResult)

const importSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	infoList: z.array(z.object({number: text, amount: text, reasonCode: z.string().nullish()})).nullish(),
})

export interface ImportedLoan {
	number: string
	amount: string
	reasonCode: string
}

/** Reads loan numbers, amounts and reasons from the bank's Excel template. Nothing is paid; the rows still need checking. */
export const importBatchLoans = async (file: File): Promise<ImportedLoan[]> => {
	const body = new FormData()
	body.append("file", file)
	const data = importSchema.parse(camelKeys(await apiClient<unknown>("/AccountBatchInstallment/Import", {method: "POST", body})))
	if (data.isSuccessful === false) throw new Error(data.message ?? "import failed")
	return (data.infoList ?? []).map((item) => ({number: String(item.number ?? "").replace(/\D/g, ""), amount: String(item.amount ?? "").replace(/\D/g, ""), reasonCode: (item.reasonCode ?? "").replace(/\s/g, "")}))
}

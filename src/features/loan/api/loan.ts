import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toTransactionResult, type PasswordType, type TransactionResult} from "@/features/transaction/api/transaction"

const text = z.union([z.string(), z.number()]).nullish()

const itemSchema = z.object({
	id: z.number().nullish(),
	accountNumber: z.string().nullish(),
	cardNumber: z.string().nullish(),
	firstName: z.string().nullish(),
	familyName: z.string().nullish(),
	accountTypeTitle: z.string().nullish(),
	accountTypeName: z.string().nullish(),
	nextLoanDate: z.string().nullish(),
	amount: text,
	totalRemain: text,
	penalty: text,
	delayRemain: text,
	wage: text,
	allLoanCount: text,
	payLoanCount: text,
	firstLoanDate: z.string().nullish(),
	isOtherLoan: z.boolean().nullish(),
	loanIdType: z.string().nullish(),
	hasError: z.boolean().nullish(),
	errorDescription: z.string().nullish(),
})

const listSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	statusList: z.array(itemSchema).nullish(),
})

export interface Loan {
	/** The account or card the loan is attached to, and whose name is on it. */
	accountNumber: string
	cardNumber: string
	holder: string
	title: string
	typeName: string
	nextDueDate: string
	installment: number | null
	remaining: number | null
	penalty: number | null
	overdue: number | null
	paidCount: number | null
	totalCount: number | null
	firstDate: string
	/** A loan of someone else the user follows. */
	isOther: boolean
	/** Whether the loan is kept on a card (its installments are paid to the card number) rather than on an account. */
	onCard: boolean
	/** The bank could tell whose loan this is, so an installment can be paid towards it. */
	payable: boolean
	error: string
}

const num = (value: string | number | null | undefined): number | null => {
	if (value === null || value === undefined || value === "") return null
	const parsed = Number(String(value).replace(/,/g, ""))
	return Number.isFinite(parsed) ? parsed : null
}

/** The status of every loan on the user's accounts and cards, and the ones they follow for others. */
export const getLoans = async (): Promise<Loan[]> => {
	const data = listSchema.parse(camelKeys(await apiClient<unknown>("/BatchLoanStatus/GetList")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "loans failed")
	return (data.statusList ?? []).map((item) => ({
		accountNumber: item.accountNumber ?? "",
		cardNumber: item.cardNumber ?? "",
		holder: [item.firstName, item.familyName].filter(Boolean).join(" "),
		title: item.accountTypeTitle ?? "",
		typeName: item.accountTypeName ?? "",
		nextDueDate: item.nextLoanDate ?? "",
		installment: num(item.amount),
		remaining: num(item.totalRemain),
		penalty: num(item.penalty),
		overdue: num(item.delayRemain),
		paidCount: num(item.payLoanCount),
		totalCount: num(item.allLoanCount),
		firstDate: item.firstLoanDate ?? "",
		isOther: item.isOtherLoan === true,
		onCard: item.loanIdType === "MyCard" || item.loanIdType === "OthersCard",
		payable: item.loanIdType !== undefined && item.loanIdType !== null && item.loanIdType !== "Unknown",
		error: item.hasError === true ? (item.errorDescription ?? "") : "",
	}))
}

export interface PayInstallmentRequest {
	sourceAccountNumber: string
	sourcePassword: string | null
	sourcePasswordType: PasswordType
	loan: Loan
	/** In Rials. */
	amount: number
	reasonCode: string
}

/**
 * Pays towards a loan from one of the user's accounts. The money goes to the loan's card number when the loan is kept
 * on a card and to its account number otherwise. A real transaction: send once per confirmation, never retry automatically.
 */
export const payInstallment = (request: PayInstallmentRequest): Promise<TransactionResult> =>
	apiClient<unknown>("/AccountInstallment/PayLoan", {
		method: "POST",
		body: JSON.stringify({
			sourceAccountInfo: {
				accountNumber: request.sourceAccountNumber,
				...(request.sourcePassword ? {accountPin: request.sourcePassword} : {}),
				passwordType: request.sourcePasswordType,
			},
			destinationCardPan: request.loan.cardNumber,
			destinationAccountNumber: request.loan.accountNumber,
			isDestinationCard: request.loan.onCard,
			amount: request.amount,
			installmentAmount: request.loan.installment ?? 0,
			addToInstallmentList: false,
			reasonCode: request.reasonCode,
		}),
	}).then(toTransactionResult)

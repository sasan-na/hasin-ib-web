import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

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
		error: item.hasError === true ? (item.errorDescription ?? "") : "",
	}))
}

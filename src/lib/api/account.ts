import {z} from "@/lib/zod"

import {apiClient} from "./client"

// camelCase, like the other post-login endpoints. Optional fields are left out by the server when
// they do not apply (for example no balances before they are fetched).
const amount = z.number().nullish()

const accountSchema = z.object({
	id: z.number(),
	name: z.string().nullish(),
	number: z.string().nullish(),
	iban: z.string().nullish(),
	type: z.string().nullish(),
	isJointAccount: z.boolean().nullish(),
	// 1 one-time password, 2 no password, 3 regular password.
	passwordType: z.number().nullish(),
	hasAccessToGetBalance: z.boolean().nullish(),
	balance: amount,
	totalBalance: amount,
	blockedAmount: amount,
})

const accountListSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	accountList: z.array(accountSchema).nullish(),
})

const balanceSchema = z.object({
	isSuccessful: z.boolean(),
	message: z.string().nullish(),
	balance: amount,
	totalBalance: amount,
	blockedAmount: amount,
})

export interface Balances {
	/** What can be withdrawn. */
	available: number | null
	total: number | null
	blocked: number | null
}

export interface Account {
	id: number
	name: string
	number: string
	iban: string
	type: string
	isJoint: boolean
	passwordType: "otp" | "none" | "password" | null
	canSeeBalance: boolean
	/** What the list already carried; null until the user asks for a fresh balance. */
	balances: Balances
}

const PASSWORD_TYPES = {1: "otp", 2: "none", 3: "password"} as const

/** The user's accounts, in the order they chose (the server sorts by their priority). */
export const getAccounts = async (): Promise<Account[]> => {
	const data = accountListSchema.parse(await apiClient<unknown>("/AccountList/GetAccounts"))
	if (data.isSuccessful === false) throw new Error(data.message ?? "account list failed")
	return (data.accountList ?? []).map((account) => ({
		id: account.id,
		name: account.name ?? "",
		number: account.number ?? "",
		iban: account.iban ?? "",
		type: account.type ?? "",
		isJoint: account.isJointAccount === true,
		passwordType: PASSWORD_TYPES[account.passwordType as keyof typeof PASSWORD_TYPES] ?? null,
		canSeeBalance: account.hasAccessToGetBalance === true,
		balances: {available: account.balance ?? null, total: account.totalBalance ?? null, blocked: account.blockedAmount ?? null},
	}))
}

/**
 * A fresh balance from the bank's core system. The server rate-limits this per account, so it only runs
 * when the user asks. Throws when the bank could not answer.
 */
export const getBalance = async (accountId: number): Promise<Balances> => {
	const data = balanceSchema.parse(await apiClient<unknown>(`/Account/GetBalance?userAccountId=${accountId}`))
	if (!data.isSuccessful) throw new Error(data.message ?? "balance failed")
	return {available: data.balance ?? null, total: data.totalBalance ?? null, blocked: data.blockedAmount ?? null}
}

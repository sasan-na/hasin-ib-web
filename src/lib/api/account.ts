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
	category: z.object({key: z.string().nullish(), name: z.string().nullish()}).nullish(),
	// The bank's per-account services (balance, info, credit calculation, ...) and whether each is on.
	defaultService: z.array(z.object({key: z.string().nullish(), isEnabled: z.boolean().nullish()})).nullish(),
	services: z.array(z.object({key: z.string().nullish(), isEnabled: z.boolean().nullish()})).nullish(),
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
	/** The group the bank files it under (current, savings, ...). Empty when the server sends none. */
	categoryKey: string
	categoryName: string
	isJoint: boolean
	passwordType: "otp" | "none" | "password" | null
	canSeeBalance: boolean
	/** The bank offers the facility (loan) credit calculation for this account. */
	canCalculateCredit: boolean
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
		categoryKey: account.category?.key ?? "",
		categoryName: account.category?.name ?? "",
		isJoint: account.isJointAccount === true,
		passwordType: PASSWORD_TYPES[account.passwordType as keyof typeof PASSWORD_TYPES] ?? null,
		canSeeBalance: account.hasAccessToGetBalance === true,
		canCalculateCredit: [...(account.defaultService ?? []), ...(account.services ?? [])].some((service) => service.key === "LoanCreditCalculate" && service.isEnabled === true),
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

const priorityResultSchema = z.object({isSuccessful: z.boolean(), message: z.string().nullish()})

/**
 * Moves the account `sourceId` to where `destinationId` is: above it when the source was below, below it
 * when the source was above (the server's rule). Throws when the server refuses.
 */
export const moveAccount = async (sourceId: number, destinationId: number): Promise<void> => {
	const data = priorityResultSchema.parse(
		await apiClient<unknown>("/AccountList/UpdatePriority", {
			method: "POST",
			body: JSON.stringify({sourceUserAccountId: sourceId, destinationUserAccountId: destinationId}),
		}),
	)
	if (!data.isSuccessful) throw new Error(data.message ?? "reorder failed")
}

const ownerSchema = z.object({id: z.number().nullish(), fullName: z.string().nullish(), image: z.string().nullish()})

const accountInfoSchema = z.object({
	isSuccessful: z.boolean(),
	message: z.string().nullish(),
	id: z.number(),
	name: z.string().nullish(),
	number: z.string().nullish(),
	accountType: z.string().nullish(),
	ibanNumber: z.string().nullish(),
	accountOwners: z.array(ownerSchema).nullish(),
})

export interface AccountOwner {
	name: string
	/** A photo URL; empty when there is none or the bank hides photos. */
	image: string
}

export interface AccountInfo {
	id: number
	name: string
	number: string
	type: string
	iban: string
	owners: AccountOwner[]
}

/** The details of one of the user's accounts (`userAccountId` is the id from the account list). */
export const getAccountInfo = async (accountId: number): Promise<AccountInfo> => {
	const data = accountInfoSchema.parse(await apiClient<unknown>(`/AccountInfo/GetAccountInfo?userAccountId=${accountId}`))
	if (!data.isSuccessful) throw new Error(data.message ?? "account info failed")
	return {
		id: data.id,
		name: data.name ?? "",
		number: data.number ?? "",
		type: data.accountType ?? "",
		iban: data.ibanNumber ?? "",
		owners: (data.accountOwners ?? []).map((owner) => ({name: owner.fullName ?? "", image: owner.image ?? ""})),
	}
}

const withdrawMemberSchema = z.object({username: z.string().nullish(), name: z.string().nullish(), image: z.string().nullish()})
const withdrawRulesSchema = z.object({
	isSuccessful: z.boolean(),
	message: z.string().nullish(),
	withdrawRules: z
		.array(
			z.object({
				withdrawGroups: z
					.array(z.object({count: z.number().nullish(), withdrawGroupMembers: z.array(withdrawMemberSchema).nullish()}))
					.nullish(),
			}),
		)
		.nullish(),
})

export interface WithdrawMember {
	name: string
	image: string
}

export interface WithdrawGroup {
	/** How many of `members` must sign; 0 (or all of them) means everyone. */
	required: number
	members: WithdrawMember[]
}

/** Who has to sign to withdraw: any one of the rules; within a rule, every group; within a group, `required` people. */
export type WithdrawRule = WithdrawGroup[]

export const getWithdrawRules = async (accountId: number): Promise<WithdrawRule[]> => {
	const data = withdrawRulesSchema.parse(await apiClient<unknown>(`/AccountInfo/GetWithdrawRule?userAccountId=${accountId}`))
	if (!data.isSuccessful) throw new Error(data.message ?? "withdraw rules failed")
	return (data.withdrawRules ?? []).map((rule) =>
		(rule.withdrawGroups ?? []).map((group) => ({
			required: group.count ?? 0,
			members: (group.withdrawGroupMembers ?? []).map((member) => ({name: member.name ?? member.username ?? "", image: member.image ?? ""})),
		})),
	)
}

/** Renames the account for this user only (the name is a personal label, not the bank's record). */
export const renameAccount = async (accountId: number, newName: string): Promise<void> => {
	const data = priorityResultSchema.parse(
		await apiClient<unknown>("/AccountInfo/ChangeAccountName", {
			method: "POST",
			body: JSON.stringify({userAccountId: accountId, newName}),
		}),
	)
	if (!data.isSuccessful) throw new Error(data.message ?? "rename failed")
}

const syncAllowedSchema = z.object({isSuccessful: z.boolean()})
const syncResultSchema = z.object({isSuccessful: z.boolean(), message: z.string().nullish(), extendedMessage: z.string().nullish(), hasChanged: z.boolean().nullish()})

/** Whether this user may refresh their account list from the bank (main users only). */
export const canSyncAccounts = async (): Promise<boolean> =>
	syncAllowedSchema.parse(await apiClient<unknown>("/SyncUserInfo/Allow")).isSuccessful

export interface SyncResult {
	hasChanged: boolean
	/** The bank's own wording of the outcome, in the UI language; may be empty. */
	message: string
}

/** Asks the bank to re-read the user's accounts. Throws with the bank's message when it refuses. */
export const syncAccounts = async (): Promise<SyncResult> => {
	const data = syncResultSchema.parse(await apiClient<unknown>("/SyncUserInfo", {method: "POST"}))
	const message = data.extendedMessage ?? data.message ?? ""
	if (!data.isSuccessful) throw new Error(message)
	return {hasChanged: data.hasChanged === true, message}
}

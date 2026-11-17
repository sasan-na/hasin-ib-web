import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {protectPasswords} from "@/features/auth/lib/password-crypto"

const accountsSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	accountList: z.array(z.object({id: z.number(), number: z.string().nullish(), hasOtp: z.boolean().nullish(), otpName: z.string().nullish()})).nullish(),
})

/** One of the user's accounts a new person could be given access to. */
export interface GrantableAccount {
	id: number
	number: string
	/** The account asks for a one-time code instead of a password. */
	hasOtp: boolean
	otpName: string
}

export const getGrantableAccounts = async (): Promise<GrantableAccount[]> => {
	const data = accountsSchema.parse(camelKeys(await apiClient<unknown>("/SubUser/GetUserAccounts")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "accounts failed")
	return (data.accountList ?? []).map((account) => ({id: account.id, number: account.number ?? "", hasOtp: account.hasOtp === true, otpName: account.otpName ?? ""}))
}

const rolesSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), roles: z.array(z.object({id: z.number(), name: z.string().nullish()})).nullish()})

export interface Role {
	id: number
	name: string
}

/** The roles (what a person may do on an account) the user has defined. */
export const getRoles = async (): Promise<Role[]> => {
	const data = rolesSchema.parse(camelKeys(await apiClient<unknown>("/SubUser/GetUserRoles")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "roles failed")
	return (data.roles ?? []).map((role) => ({id: role.id, name: role.name ?? String(role.id)}))
}

const existingSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), exceedMessage: z.string().nullish()})

/** Checks that a person who already uses the bank can be added. Throws with the bank's text when not. */
export const checkExistingUser = async (username: string, customerCode: string): Promise<void> => {
	const data = existingSchema.parse(camelKeys(await apiClient<unknown>(`/SubUser/CheckExistingUser?username=${encodeURIComponent(username)}&customerCode=${encodeURIComponent(customerCode)}`)))
	if (data.isSuccessful === false) throw new Error(data.exceedMessage ?? data.message ?? "existing user failed")
}

export interface GrantedAccount {
	accountNumber: string
	/** The user's own password (or code) for the account. */
	masterPassword: string
	/** The password the new person will use on this account. */
	subUserPassword: string
	roleId: number
}

export interface NewSubUser {
	/** A person who already uses the bank, found by customer code. */
	existing: boolean
	username: string
	password: string
	customerCode: string
	accounts: GrantedAccount[]
}

const resultSchema = z.object({
	addSubUserSuccessful: z.boolean().nullish(),
	addSubUserMessage: z.string().nullish(),
	subUsername: z.string().nullish(),
	accountCount: z.union([z.string(), z.number()]).nullish(),
	createDate: z.string().nullish(),
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
})

export interface NewSubUserResult {
	ok: boolean
	message: string
	username: string
	accountCount: string
}

/**
 * Adds a person who may act on some of the user's accounts. The new password travels encrypted under a fresh ticket.
 * A real change: send once per confirmation, never retry automatically.
 */
export const addSubUser = async (request: NewSubUser): Promise<NewSubUserResult> => {
	const {ticket, encrypted} = await protectPasswords(request.password)
	const data = resultSchema.parse(
		camelKeys(
			await apiClient<unknown>("/SubUser/AddSubUser", {
				method: "POST",
				body: JSON.stringify({
					accountList: request.accounts.map((account) => ({accountNumber: account.accountNumber, masterPassword: account.masterPassword, subUserPassword: account.subUserPassword, roleId: account.roleId, hasPasswordBeenChanged: true})),
					username: request.username,
					customerCode: request.customerCode,
					password: encrypted[0],
					isExistingUser: request.existing,
					isEncrypted: true,
					ticket,
				}),
			}),
		),
	)
	if (data.isSuccessful === false && data.addSubUserSuccessful === undefined) throw new Error(data.message ?? "add sub-user failed")
	return {ok: data.addSubUserSuccessful === true, message: data.addSubUserMessage ?? data.message ?? "", username: data.subUsername ?? request.username, accountCount: data.accountCount === null || data.accountCount === undefined ? "" : String(data.accountCount)}
}

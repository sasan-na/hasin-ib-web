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
	subUserAccountResults: z.array(z.object({accountNumber: z.string().nullish(), isSuccessful: z.boolean().nullish(), message: z.string().nullish()})).nullish(),
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
	/** Accounts the bank could not change, with its reason. */
	failures: {accountNumber: string; message: string}[]
}

const toResult = (data: z.infer<typeof resultSchema>, fallbackUsername: string): NewSubUserResult => ({
	ok: data.addSubUserSuccessful === true,
	message: data.addSubUserMessage ?? data.message ?? "",
	username: data.subUsername ?? fallbackUsername,
	accountCount: data.accountCount === null || data.accountCount === undefined ? "" : String(data.accountCount),
	failures: (data.subUserAccountResults ?? []).filter((item) => item.isSuccessful === false).map((item) => ({accountNumber: item.accountNumber ?? "", message: item.message ?? ""})),
})

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
	return toResult(data, request.username)
}

const editInfoSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	isExistingUser: z.boolean().nullish(),
	username: z.string().nullish(),
	isMyChild: z.boolean().nullish(),
	userAccounts: z.array(z.object({accountNumber: z.string().nullish(), roleId: z.number().nullish()})).nullish(),
})

export interface EditableSubUser {
	username: string
	/** A registered user of the bank rather than a sub-user: they keep their own sign-in password. */
	existing: boolean
	/** Only the person who created a sub-user may change their passwords. */
	isMine: boolean
	/** The accounts they can act on now, with their roles. */
	accounts: {accountNumber: string; roleId: number}[]
}

/** A person as they are now, ready to be changed. */
export const getSubUserForEdit = async (id: number): Promise<EditableSubUser> => {
	const data = editInfoSchema.parse(camelKeys(await apiClient<unknown>(`/SubUser/GetSubUserToEdit?userId=${id}`)))
	if (data.isSuccessful === false || !data.username) throw new Error(data.message ?? "sub-user not found")
	return {
		username: data.username,
		existing: data.isExistingUser === true,
		isMine: data.isMyChild === true,
		accounts: (data.userAccounts ?? []).map((account) => ({accountNumber: account.accountNumber ?? "", roleId: account.roleId ?? 0})),
	}
}

export interface SubUserChange {
	username: string
	existing: boolean
	/** A new sign-in password; empty keeps the current one. */
	newPassword: string
	/** Every account the person should have after the change; any account left out loses access. */
	accounts: (GrantedAccount & {passwordChanged: boolean})[]
}

/**
 * Changes a person's roles, accounts and passwords. The bank adds, changes and removes accounts one by one, so some can fail
 * while others succeed (see failures). A real change: send once per confirmation, never retry automatically.
 */
export const editSubUser = async (change: SubUserChange): Promise<NewSubUserResult> => {
	const protectedPassword = change.newPassword === "" ? null : await protectPasswords(change.newPassword)
	const data = resultSchema.parse(
		camelKeys(
			await apiClient<unknown>("/SubUser/EditSubUser", {
				method: "POST",
				body: JSON.stringify({
					accountList: change.accounts.map((account) => ({accountNumber: account.accountNumber, masterPassword: account.masterPassword, subUserPassword: account.subUserPassword, roleId: account.roleId, hasPasswordBeenChanged: account.passwordChanged})),
					username: change.username,
					customerCode: "",
					password: protectedPassword ? protectedPassword.encrypted[0] : "",
					isExistingUser: change.existing,
					hasPasswordBeenChanged: protectedPassword !== null,
					isEncrypted: protectedPassword !== null,
					ticket: protectedPassword?.ticket ?? "",
				}),
			}),
		),
	)
	if (data.isSuccessful === false && data.addSubUserSuccessful === undefined) throw new Error(data.message ?? "edit sub-user failed")
	return toResult(data, change.username)
}

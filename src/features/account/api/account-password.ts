import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {protectPasswords} from "@/features/auth/lib/password-crypto"

const detailsSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	// 1 one-time password, 2 no password, 3 regular password.
	passwordType: z.number().nullish(),
	accountNumber: z.string().nullish(),
})

export interface AccountPasswordDetails {
	number: string
	/** True when the bank asks for the account password on transactions. */
	asksPassword: boolean
	/** The account is protected by a token (one-time passwords) instead of a password the user can change. */
	usesToken: boolean
}

/** How this account is protected right now. */
export const getAccountPasswordDetails = async (accountId: number): Promise<AccountPasswordDetails> => {
	const data = detailsSchema.parse(camelKeys(await apiClient<unknown>(`/AccountPassword/GetAccountDetails?userAccountId=${accountId}`)))
	if (data.isSuccessful === false) throw new Error(data.message ?? "account details failed")
	return {number: data.accountNumber ?? "", asksPassword: data.passwordType !== 2, usesToken: data.passwordType === 1}
}

const applicationsSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	applications: z
		.array(z.object({key: z.string(), name: z.string().nullish(), username: z.string().nullish(), hasToken: z.boolean().nullish()}))
		.nullish(),
})

/** A way into the account (internet, mobile or telephone banking) whose password can be changed. */
export interface Gateway {
	key: string
	name: string
	username: string
	/** Protected by a token, so there is no password to change here. */
	hasToken: boolean
}

export const getGateways = async (accountId: number): Promise<Gateway[]> => {
	const data = applicationsSchema.parse(camelKeys(await apiClient<unknown>(`/AccountPassword/GetAccountApplications?userAccountId=${accountId}`)))
	if (data.isSuccessful === false) throw new Error(data.message ?? "gateways failed")
	return (data.applications ?? []).map((app) => ({key: app.key, name: app.name ?? app.key, username: app.username ?? "", hasToken: app.hasToken === true}))
}

const resultSchema = z.object({isSuccessful: z.boolean(), message: z.string().nullish()})

export interface PasswordChangeResult {
	ok: boolean
	message: string
}

/**
 * Changes the account password for one gateway. A refusal (wrong old password, weak new one) comes back as
 * `ok: false` with the bank's text; a network failure throws.
 */
export const changeAccountPassword = async (params: {accountId: number; gateway: Gateway; oldPassword: string; newPassword: string}): Promise<PasswordChangeResult> => {
	const {ticket, encrypted} = await protectPasswords(params.oldPassword, params.newPassword)
	const data = resultSchema.parse(
		camelKeys(
			await apiClient<unknown>("/AccountPassword/ChangeAccountPassword", {
				method: "POST",
				body: JSON.stringify({
					userAccountId: params.accountId,
					oldPin: encrypted[0],
					newPin: encrypted[1],
					isEncrypted: true,
					ticket,
					application: params.gateway.key,
					applicationUsername: params.gateway.username,
				}),
			}),
		),
	)
	return {ok: data.isSuccessful, message: data.message ?? ""}
}

/** Switches "ask for the account password on transactions" on or off; the current password confirms it. */
export const setPasswordRequired = async (params: {accountId: number; required: boolean; password: string}): Promise<PasswordChangeResult> => {
	const {ticket, encrypted} = await protectPasswords(params.password)
	const data = resultSchema.parse(
		camelKeys(
			await apiClient<unknown>("/AccountPassword/ChangeAccountCheckPassword", {
				method: "POST",
				body: JSON.stringify({userAccountId: params.accountId, pin: encrypted[0], userAccountPasswordCheck: params.required, isEncrypted: true, ticket}),
			}),
		),
	)
	return {ok: data.isSuccessful, message: data.message ?? ""}
}

import {protectPasswords} from "@/lib/auth/passwordCrypto"
import {z} from "@/lib/zod"

import {apiClient} from "./client"

// These endpoints answer camelCase. A failure comes back as HTTP 200 with `isSuccessful: false`.
const resultSchema = z.object({
	isSuccessful: z.boolean(),
	message: z.string().nullish(),
	errorCode: z.string().nullish(),
	errorKeys: z.array(z.string()).nullish(),
	shouldLogOut: z.boolean().nullish(),
})

const ruleSchema = z.object({key: z.string(), errorMessage: z.string()})
const rulesSchema = resultSchema.extend({
	errors: z
		.array(ruleSchema.extend({subErrors: z.array(ruleSchema).nullish()}))
		.nullish(),
})

export interface PasswordRule {
	key: string
	message: string
	subRules: {key: string; message: string}[]
}

/** The server refused: `message` is its text (may be empty), `ruleKeys` the password rules that were broken. */
export class PasswordError extends Error {
	readonly ruleKeys: string[]
	readonly shouldLogOut: boolean

	constructor(message: string, ruleKeys: string[] = [], shouldLogOut = false) {
		super(message)
		this.name = "PasswordError"
		this.ruleKeys = ruleKeys
		this.shouldLogOut = shouldLogOut
	}
}

const post = async (endpoint: string, body: unknown) =>
	resultSchema.parse(await apiClient<unknown>(endpoint, {method: "POST", body: JSON.stringify(body)}))

/** The bank's password policy: each rule with its sub-rules, in display order. */
export const getPasswordRules = async (): Promise<PasswordRule[]> => {
	const data = rulesSchema.parse(await apiClient<unknown>("/UserPassword/GetAllPasswordErrors"))
	if (!data.isSuccessful) throw new PasswordError(data.message ?? "")
	return (data.errors ?? []).map((rule) => ({
		key: rule.key,
		message: rule.errorMessage,
		subRules: (rule.subErrors ?? []).map((sub) => ({key: sub.key, message: sub.errorMessage})),
	}))
}

/** The keys of the rules `password` breaks, checked by the server. Empty when it is acceptable. */
export const checkPasswordRules = async (username: string, password: string): Promise<string[]> => {
	const {ticket, encrypted} = await protectPasswords(password)
	const data = await post(
		"/UserPassword/GetPasswordErrors",
		{username, password: encrypted[0], isEncrypted: true, ticket},
	)
	if (!data.isSuccessful) throw new PasswordError(data.message ?? "")
	return data.errorKeys ?? []
}

/** Changes the password. Throws `PasswordError` when the server refuses. */
export const changePassword = async (oldPassword: string, newPassword: string, isPassExpired: boolean): Promise<void> => {
	const {ticket, encrypted} = await protectPasswords(oldPassword, newPassword)
	const data = await post(
		"/UserPassword/ChangePassword",
		{oldPassword: encrypted[0], newPassword: encrypted[1], isPassExpired, isEncrypted: true, ticket},
	)
	if (!data.isSuccessful) throw new PasswordError(data.message ?? "", data.errorKeys ?? [], data.shouldLogOut === true)
}

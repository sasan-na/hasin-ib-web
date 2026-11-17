import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const rulesSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	errors: z.array(z.object({key: z.string().nullish(), errorMessage: z.string().nullish(), subErrors: z.array(z.object({key: z.string().nullish(), errorMessage: z.string().nullish()})).nullish()})).nullish(),
})

export interface UsernameRule {
	key: string
	message: string
}

/** The bank's rules for a username, as it words them. Sub-rules are listed after their rule. */
export const getUsernameRules = async (): Promise<UsernameRule[]> => {
	const data = rulesSchema.parse(camelKeys(await apiClient<unknown>("/Profile/GetAllUsernameErrors")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "username rules failed")
	return (data.errors ?? []).flatMap((rule) => [
		{key: rule.key ?? "", message: rule.errorMessage ?? ""},
		...(rule.subErrors ?? []).map((sub) => ({key: sub.key ?? "", message: sub.errorMessage ?? ""})),
	])
}

const resultSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), errorKeys: z.array(z.string()).nullish(), shouldLogOut: z.boolean().nullish()})

/** The bank refused the new username: `message` is its text (may be empty) and `ruleKeys` the rules it breaks. */
export class UsernameError extends Error {
	readonly ruleKeys: string[]
	readonly shouldLogOut: boolean

	constructor(message: string, ruleKeys: string[] = [], shouldLogOut = false) {
		super(message)
		this.name = "UsernameError"
		this.ruleKeys = ruleKeys
		this.shouldLogOut = shouldLogOut
	}
}

/** Changes the sign-in username. The user has to sign in again afterwards. Throws `UsernameError` when the bank refuses. */
export const changeUsername = async (newUsername: string, password: string): Promise<void> => {
	const data = resultSchema.parse(camelKeys(await apiClient<unknown>("/Profile/ChangeUsername", {method: "POST", body: JSON.stringify({newUsername, password})})))
	if (data.isSuccessful === false) throw new UsernameError(data.message ?? "", data.errorKeys ?? [], data.shouldLogOut === true)
}

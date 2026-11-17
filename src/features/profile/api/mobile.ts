import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {protectPasswords} from "@/features/auth/lib/password-crypto"

const infoSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	errorCode: z.string().nullish(),
	username: z.string().nullish(),
	mobileNumbers: z.array(z.string()).nullish(),
	hasOTP: z.boolean().nullish(),
	hasOtp: z.boolean().nullish(),
})

/** The user's mobile banking login: who they are there, and which phones may receive its codes. */
export interface MobileInfo {
	username: string
	numbers: string[]
	/** The login uses a one-time code, so there is no password to change here. */
	hasOtp: boolean
}

/** Null when the bank has no mobile banking login for this user (the gateway is inactive). */
export const getMobileInfo = async (): Promise<MobileInfo | null> => {
	const data = infoSchema.parse(camelKeys(await apiClient<unknown>("/Profile/Mobile/GetMobileInfo?loadMobileNumbers=true")))
	if (data.isSuccessful === false || !data.username) return null
	return {username: data.username, numbers: data.mobileNumbers ?? [], hasOtp: (data.hasOTP ?? data.hasOtp) === true}
}

const resultSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), errorKeys: z.array(z.string()).nullish()})

/** The bank refused: `message` is its text (may be empty) and `ruleKeys` the password rules broken. */
export class MobileChangeError extends Error {
	readonly ruleKeys: string[]

	constructor(message: string, ruleKeys: string[] = []) {
		super(message)
		this.name = "MobileChangeError"
		this.ruleKeys = ruleKeys
	}
}

/** Sets the phone numbers allowed for mobile banking. A real change: send once per confirmation. */
export const setMobileNumbers = async (numbers: string[]): Promise<void> => {
	const data = resultSchema.parse(camelKeys(await apiClient<unknown>("/Profile/Mobile/SetMobileNumber", {method: "POST", body: JSON.stringify({mobileNumbers: numbers})})))
	if (data.isSuccessful === false) throw new MobileChangeError(data.message ?? "")
}

/** Changes the mobile banking password. A real change: send once per confirmation. */
export const changeMobilePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
	const {ticket, encrypted} = await protectPasswords(oldPassword, newPassword)
	const data = resultSchema.parse(
		camelKeys(await apiClient<unknown>("/Profile/Mobile/ChangeMobilePassword", {method: "POST", body: JSON.stringify({oldPassword: encrypted[0], newPassword: encrypted[1], isPassExpired: false, isEncrypted: true, ticket})})),
	)
	if (data.isSuccessful === false) throw new MobileChangeError(data.message ?? "", data.errorKeys ?? [])
}

import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {getCmsData, inquireHamoonSignature, requestHamoonSignature, TOKEN_TYPE} from "@/features/cheque/api/hamoon"

/** The bank's code for activating the digital cheque service (the registry's "function code"). */
const ACTIVATION_FUNCTION_CODE = "271"
/** 1 activates the service for the first time; 2 refreshes an activation. */
const ACTIVATE = 1
/** What the customer reads in the Hamoon app while deciding whether to approve. */
const HAMOON_TEXT = "فعال‌سازی چکاد"

const challengeSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	result: z.object({result: z.object({data: z.object({challengeCode: z.number().nullish(), activationTicketId: z.string().nullish()}).nullish()}).nullish()}).nullish(),
})

/** What the registry gave for this activation attempt, and the Hamoon approval the customer is now asked for. */
export interface ActivationAttempt {
	challengeCode: number
	activationTicketId: string
	/** When the signing request was made; the registry wants it back with the signature. */
	dateTime: string
	msspTransId: string
}

/**
 * Starts activating the digital cheque service: gets a challenge from the registry and sends the customer a signing request
 * in the Hamoon app. Nothing is activated yet; starting again simply begins a new attempt.
 */
export const startActivation = async (nationalCode: string): Promise<ActivationAttempt> => {
	const challenge = challengeSchema.parse(camelKeys(await apiClient<unknown>("/Chakad/SendChallengeCode", {method: "POST", body: JSON.stringify({requestType: ACTIVATE, tokenType: TOKEN_TYPE})})))
	const data = challenge.result?.result?.data
	if (challenge.isSuccessful === false || data?.challengeCode == null || !data.activationTicketId) throw new Error(challenge.message ?? "")
	const model = {challengeCode: data.challengeCode, activationTicketId: data.activationTicketId, requestType: ACTIVATE, signData: {tokenType: TOKEN_TYPE}}
	const cms = await getCmsData(ACTIVATION_FUNCTION_CODE, model)
	const msspTransId = await requestHamoonSignature(cms.tbsBase64, HAMOON_TEXT, nationalCode)
	return {challengeCode: data.challengeCode, activationTicketId: data.activationTicketId, dateTime: cms.dateTime, msspTransId}
}

/** The registry wants the signature wrapped as a PKCS#7 text block, 64 characters to a line. */
const pkcs7 = (base64: string): string => `-----BEGIN PKCS7-----\n${(base64.match(/.{1,64}/g) ?? []).join("\n")}\n-----END PKCS7-----\r\n`

const activateSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish()})

export type ActivationOutcome = {state: "waiting"} | {state: "done"} | {state: "refused"; message: string}

/**
 * Completes the activation once the customer has approved it in the Hamoon app. "waiting" means they have not yet. A real
 * change: send once per confirmation, never retry automatically; a thrown error means the answer is unknown.
 */
export const finishActivation = async (attempt: ActivationAttempt): Promise<ActivationOutcome> => {
	const signature = await inquireHamoonSignature(attempt.msspTransId)
	if (!signature) return {state: "waiting"}
	const data = activateSchema.parse(
		camelKeys(
			await apiClient<unknown>("/Chakad/CustomerActivation", {
				method: "POST",
				body: JSON.stringify({
					challengeCode: attempt.challengeCode,
					activationTicketId: attempt.activationTicketId,
					requestType: ACTIVATE,
					requestDateTime: attempt.dateTime,
					signData: {cms: pkcs7(signature), tokenType: TOKEN_TYPE, dateTime: attempt.dateTime},
				}),
			}),
		),
	)
	return data.isSuccessful === false ? {state: "refused", message: data.message ?? ""} : {state: "done"}
}

import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toTransactionResult, type PasswordType, type TransactionResult} from "@/features/transaction/api/transaction"

const listSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	otps: z.array(z.object({serial: z.string().nullish(), isExtendable: z.boolean().nullish(), expiryDate: z.string().nullish(), nextExpiryDate: z.string().nullish(), cost: z.number().nullish()})).nullish(),
})

/** A one-time-password token the user pays a yearly fee for (used with the bank's USSD service). */
export interface UssdToken {
	serial: string
	extendable: boolean
	expiryDate: string
	/** The expiry date once the fee is paid. */
	nextExpiryDate: string
	/** The fee, in Rials. */
	cost: number
}

export const getUssdTokens = async (): Promise<UssdToken[]> => {
	const data = listSchema.parse(camelKeys(await apiClient<unknown>("/Otp/GetOtpList")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "ussd tokens failed")
	return (data.otps ?? []).map((item) => ({serial: item.serial ?? "", extendable: item.isExtendable === true, expiryDate: item.expiryDate ?? "", nextExpiryDate: item.nextExpiryDate ?? "", cost: item.cost ?? 0}))
}

export interface ExtendRequest {
	sourceAccountNumber: string
	sourcePassword: string | null
	sourcePasswordType: PasswordType
	serial: string
}

/** Pays the fee that extends a token. A real transaction: send once per confirmation, never retry automatically. */
export const extendUssdToken = (request: ExtendRequest): Promise<TransactionResult> =>
	apiClient<unknown>("/AccountPayUSSDFee/ExtendUSSDOtp", {
		method: "POST",
		body: JSON.stringify({
			sourceAccountInfo: {
				accountNumber: request.sourceAccountNumber,
				...(request.sourcePassword ? {accountPin: request.sourcePassword} : {}),
				passwordType: request.sourcePasswordType,
			},
			tokenSerial: request.serial,
		}),
	}).then(toTransactionResult)

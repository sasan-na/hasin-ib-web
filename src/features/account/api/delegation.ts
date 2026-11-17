import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {toTransactionResult, type PasswordType, type TransactionResult} from "@/features/transaction/api/transaction"

// The bank's organs (companies) an account can be delegated to. The list comes from the core system and
// arrives wrapped in its own envelope, with "Y"/"N" flags.
const organsSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	result: z
		.object({
			objectValue: z
				.object({
					proxyAccountCompaniesReturnMessageType: z
						.array(z.object({companyType: z.number(), companyName: z.string().nullish(), isActive: z.string().nullish()}))
						.nullish(),
				})
				.nullish(),
		})
		.nullish(),
})

export interface Organ {
	/** What is sent back when delegating. */
	id: number
	name: string
}

export const getOrgans = async (): Promise<Organ[]> => {
	const data = organsSchema.parse(await apiClient<unknown>("/DelegationAccount/GetOrgans2"))
	if (data.isSuccessful === false) throw new Error(data.message ?? "organs failed")
	return (data.result?.objectValue?.proxyAccountCompaniesReturnMessageType ?? [])
		.filter((organ) => organ.isActive?.toUpperCase() === "Y")
		.map((organ) => ({id: organ.companyType, name: organ.companyName ?? String(organ.companyType)}))
}

export interface DelegationRequest {
	sourceAccountNumber: string
	/** The account's password or code; omitted when it needs none. */
	sourcePassword: string | null
	sourcePasswordType: PasswordType
	organId: number
}

/**
 * Asks the bank to make the account delegable to an organ. This changes who can act on the account, so it is
 * sent once per confirmation and never retried automatically. A refusal comes back as `ok: false`.
 */
export const requestDelegation = async (request: DelegationRequest): Promise<TransactionResult> =>
	toTransactionResult(
		await apiClient<unknown>("/DelegationAccount/Action", {
			method: "POST",
			body: JSON.stringify({
				delegatedOrgan: String(request.organId),
				sourceAccountInfo: {
					accountNumber: request.sourceAccountNumber,
					...(request.sourcePassword ? {accountPin: request.sourcePassword} : {}),
					passwordType: request.sourcePasswordType,
				},
			}),
		}),
	)

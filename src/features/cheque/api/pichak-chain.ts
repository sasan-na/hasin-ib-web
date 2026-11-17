import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const text = z.union([z.string(), z.number()]).nullish()
const str = (value: string | number | null | undefined): string => (value === null || value === undefined ? "" : String(value))

const responseSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: text,
	result: z
		.object({
			result: z
				.object({
					data: z
						.object({
							chain: z
								.array(
									z.object({
										roleType: text,
										roleTypeDescription: text,
										customers: z.array(z.object({name: text, idCode: text, idType: text})).nullish(),
									}),
								)
								.nullish(),
						})
						.nullish(),
				})
				.nullish(),
		})
		.nullish(),
})

export interface ChainCustomer {
	name: string
	idCode: string
	/** 1 real, 2 legal, 3 real foreigner, 4 legal foreigner. */
	idType: string
}

/** One step of a cheque's journey: who wrote it, who it was written to, or who it was passed on to. */
export interface ChainStep {
	/** 1 the drawer, 2 the first receiver, 3 someone it was passed on to. */
	role: string
	/** The registry's own wording of the role, in Persian. */
	roleText: string
	customers: ChainCustomer[]
}

/** The cheque kinds this inquiry tells apart. */
export type ChainChequeType = 1 | 2 | 3 | 4

/**
 * The chain of people a cheque has passed through, from the registry. The registry wants to know the cheque's kind
 * too. Throws with the bank's text when the registry cannot answer.
 */
export const getTransfersChain = async (sayyadId: string, chequeType: ChainChequeType): Promise<ChainStep[]> => {
	const data = responseSchema.parse(camelKeys(await apiClient<unknown>("/Chakad/ChakadTransfersChainInquiry", {method: "POST", body: JSON.stringify({sayyadId, chequeType})})))
	if (data.isSuccessful === false) throw new Error(typeof data.message === "string" ? data.message : "")
	return (data.result?.result?.data?.chain ?? []).map((step) => ({
		role: str(step.roleType),
		roleText: str(step.roleTypeDescription),
		customers: (step.customers ?? []).map((customer) => ({name: str(customer.name), idCode: str(customer.idCode), idType: str(customer.idType)})),
	}))
}

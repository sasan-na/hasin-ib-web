import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const text = z.string().nullish()

const schema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: text,
	extendedMessage: text,
	result: z
		.object({
			result: z
				.object({
					data: z
						.array(
							z.object({
								sayadId: text,
								serialNo: text,
								seriesNo: text,
								fromIban: text,
								amount: z.union([z.number(), z.string()]).nullish(),
								dueDate: text,
								description: text,
								reason: text,
								chequeMediaDescription: text,
								chequeTypeDescription: text,
								chequeStatusDescription: text,
								blockStatusDescription: text,
								guaranteeStatusDescription: text,
								lockedDescription: text,
								sharedDescription: text,
								operations: z.array(z.object({title: text, key: text, isEnable: z.boolean().nullish()})).nullish(),
							}),
						)
						.nullish(),
				})
				.nullish(),
		})
		.nullish(),
})

/** What the bank lets this customer do with a cheque in the cartable. */
export interface CartableOperation {
	key: string
	title: string
}

export interface CartableCheque {
	sayyadId: string
	serial: string
	series: string
	iban: string
	/** In Rials. */
	amount: number
	/** As the registry writes it ("14050101"). */
	dueDate: string
	description: string
	media: string
	type: string
	status: string
	blocked: string
	guarantee: string
	locked: string
	shared: string
	/** Only the operations that are allowed right now. */
	operations: CartableOperation[]
}

/** The digital cheques that concern the customer (as drawer, holder or guarantor), each with what can be done with it. */
export const getCartable = async (): Promise<CartableCheque[]> => {
	const data = schema.parse(camelKeys(await apiClient<unknown>("/Chakad/ChakadCartable", {method: "POST", body: JSON.stringify({})})))
	if (data.isSuccessful === false) throw new Error(data.extendedMessage ?? data.message ?? "")
	return (data.result?.result?.data ?? []).map((item) => ({
		sayyadId: item.sayadId ?? "",
		serial: item.serialNo ?? "",
		series: item.seriesNo ?? "",
		iban: item.fromIban ?? "",
		amount: Number(item.amount ?? 0) || 0,
		dueDate: item.dueDate ?? "",
		description: item.description ?? "",
		media: item.chequeMediaDescription ?? "",
		type: item.chequeTypeDescription ?? "",
		status: item.chequeStatusDescription ?? "",
		blocked: item.blockStatusDescription ?? "",
		guarantee: item.guaranteeStatusDescription ?? "",
		locked: item.lockedDescription ?? "",
		shared: item.sharedDescription ?? "",
		operations: (item.operations ?? []).filter((operation) => operation.isEnable === true && operation.key).map((operation) => ({key: operation.key ?? "", title: operation.title ?? ""})),
	}))
}

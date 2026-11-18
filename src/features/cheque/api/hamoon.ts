import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const base = {isSuccessful: z.boolean().nullish(), message: z.string().nullish(), extendedMessage: z.string().nullish()}

/** Which kind of signing token the registry expects: 1 is the Namad token the Hamoon app provides. */
export const TOKEN_TYPE = 1
const MSS_URI = "http://mss.isc.co.ir/v1.0/CMS-ATT/NRS-SHA256/DGS/SRJ"

const cmsSchema = z.object({...base, tbsBase64: z.string().nullish(), requestDateTime: z.string().nullish(), assignDate: z.string().nullish()})

export interface CmsData {
	/** What the customer is asked to sign, encoded for the Hamoon service. */
	tbsBase64: string
	/** When the request was made, as the registry wants it back with the signature (empty for some requests). */
	dateTime: string
}

/** Asks the bank what has to be signed for one of the registry's functions (271 activation, 273 issuing a cheque, ...). */
export const getCmsData = async (functionCode: string, model: unknown): Promise<CmsData> => {
	const data = cmsSchema.parse(camelKeys(await apiClient<unknown>("/Chakad/GetCmsData", {method: "POST", body: JSON.stringify({functionCode, model})})))
	if (data.isSuccessful === false || !data.tbsBase64) throw new Error(data.extendedMessage ?? data.message ?? "")
	return {tbsBase64: data.tbsBase64, dateTime: data.requestDateTime ?? data.assignDate ?? ""}
}

const requestSchema = z.object({...base, result: z.object({data: z.object({msspTransId: z.string().nullish()}).nullish()}).nullish()})

/**
 * Sends something to sign to the customer's Hamoon app. The customer approves it there; the id returned names that approval.
 * Nothing is recorded by the bank yet, so asking again (which sends a fresh request to the app) is harmless.
 */
export const requestHamoonSignature = async (tbsBase64: string, shownToCustomer: string, nationalCode: string): Promise<string> => {
	const data = requestSchema.parse(
		camelKeys(
			await apiClient<unknown>("/Hamoon/RequestSignature", {
				method: "POST",
				body: JSON.stringify({dataToBeSignedValue: tbsBase64, dataToBeDisplayedValue: shownToCustomer, mssUri: MSS_URI, apTransId: "", owner: nationalCode, holder: nationalCode}),
			}),
		),
	)
	const id = data.result?.data?.msspTransId
	if (data.isSuccessful === false || !id) throw new Error(data.extendedMessage ?? data.message ?? "")
	return id
}

const inquireSchema = z.object({...base, result: z.object({data: z.object({mssSignature: z.object({base64Signature: z.string().nullish()}).nullish()}).nullish()}).nullish()})

/** The signature of an approval, or null while the customer has not approved it in the app yet. */
export const inquireHamoonSignature = async (msspTransId: string): Promise<string | null> => {
	const data = inquireSchema.parse(camelKeys(await apiClient<unknown>("/Hamoon/InquireSignature", {method: "POST", body: JSON.stringify({msspTransId})})))
	if (data.isSuccessful === false) throw new Error(data.extendedMessage ?? data.message ?? "")
	return data.result?.data?.mssSignature?.base64Signature || null
}

import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const servicesSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), result: z.array(z.object({name: z.string().nullish(), serviceType: z.string().nullish()})).nullish()})

export interface BranchService {
	/** What the bank sends back to ask for requests of this kind. */
	type: string
	name: string
}

/** The kinds of request the user can have made at a branch. */
export const getBranchServices = async (): Promise<BranchService[]> => {
	const data = servicesSchema.parse(camelKeys(await apiClient<unknown>("/Intra/GetIntraServices")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "branch services failed")
	return (data.result ?? []).map((service) => ({type: service.serviceType ?? "", name: service.name ?? service.serviceType ?? ""}))
}

const listSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	errorCode: z.string().nullish(),
	items: z
		.array(
			z.object({
				referenceCode: z.string().nullish(),
				date: z.string().nullish(),
				service: z.string().nullish(),
				details: z.string().nullish(),
				status: z.string().nullish(),
				declineReason: z.string().nullish(),
				trackingCode: z.string().nullish(),
				description: z.string().nullish(),
				requestFile: z.string().nullish(),
			}),
		)
		.nullish(),
})

/** Where a request stands: "0" rejected, "1" confirmed, "2" needs correction, "3" continues at the branch, anything else not processed yet. */
export type BranchStatus = "rejected" | "confirmed" | "needCorrection" | "continueInBranch" | "notProcessed"

const statusOf = (value: string | null | undefined): BranchStatus => (value === "0" ? "rejected" : value === "1" ? "confirmed" : value === "2" ? "needCorrection" : value === "3" ? "continueInBranch" : "notProcessed")

export interface BranchRequest {
	reference: string
	date: Date | null
	service: string
	status: BranchStatus
	declineReason: string
	trackingCode: string
	description: string
	/** A PDF (base64) with the request's details, when the bank has one. */
	details: string
	/** A PDF (base64) of the request itself, when the bank kept one. */
	file: string
}

export interface BranchFilter {
	reference: string
	/** "YYYY-MM-DD" or empty. */
	from: string
	to: string
	serviceType: string
	accountNumber: string
}

/** The user's requests made through branch services. The bank answers with an error code instead of a list when there are none. */
export const getBranchRequests = async (filter: BranchFilter): Promise<BranchRequest[]> => {
	const data = listSchema.parse(
		camelKeys(
			await apiClient<unknown>("/Intra/Inquiry", {
				method: "POST",
				body: JSON.stringify({
					referenceNumber: filter.reference,
					startDate: filter.from === "" ? "" : `${filter.from}T00:00:00`,
					endDate: filter.to === "" ? "" : `${filter.to}T23:59:59`,
					serviceType: filter.serviceType,
					...(filter.accountNumber === "" ? {} : {accountNumber: filter.accountNumber}),
				}),
			}),
		),
	)
	if (data.isSuccessful === false && data.errorCode !== "706" && data.message) throw new Error(data.message)
	return (data.items ?? []).map((item) => {
		const time = item.date ? Date.parse(item.date) : NaN
		return {
			reference: item.referenceCode ?? "",
			date: Number.isFinite(time) ? new Date(time) : null,
			service: item.service ?? "",
			status: statusOf(item.status),
			declineReason: item.declineReason ?? "",
			trackingCode: item.trackingCode ?? "",
			description: item.description ?? "",
			details: item.details ?? "",
			file: item.requestFile ?? "",
		}
	})
}

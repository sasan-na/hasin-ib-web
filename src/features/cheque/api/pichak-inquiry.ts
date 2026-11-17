import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

// The bank forwards the central registry's answer as it is, so every field may be a string or a number.
const text = z.union([z.string(), z.number()]).nullish()
const str = (value: string | number | null | undefined): string => (value === null || value === undefined ? "" : String(value))

const personSchema = z.object({name: text, idType: text, idCode: text})

const detailSchema = z.object({
	seriNo: text,
	serialNo: text,
	iban: text,
	amount: text,
	dueDate: text,
	issueDate: text,
	description: text,
	bankCode: text,
	bankName: text,
	branchCode: text,
	branchName: text,
	chequeType: text,
	chequeMedia: text,
	chequeStatus: text,
	guaranteeStatus: text,
	chequeBlock: text,
	reasonCodeStr: text,
	wsrecieverInquiryType: z.array(personSchema).nullish(),
	wssignerInquiryType: z.array(personSchema).nullish(),
})

const ownerSchema = z.object({
	result: z
		.object({
			data: z
				.object({
					onGoing: text,
					blocked: text,
					ownersInfo: z.array(z.object({idCode: text, idType: text, bounced: text, cleared: text})).nullish(),
				})
				.nullish(),
		})
		.nullish(),
})

const responseSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: text,
	response: detailSchema.nullish(),
	ownerInquiryResult: ownerSchema.nullish(),
})

export interface PichakPerson {
	name: string
	/** 1 real, 2 legal, 3 real foreigner, 4 legal foreigner. */
	idType: string
	idCode: string
}

export interface PichakCheque {
	series: string
	serial: string
	iban: string
	/** In Rials. */
	amount: string
	dueDate: string
	issueDate: string
	description: string
	bank: string
	branch: string
	/** The registry's codes; the page turns them into words. */
	chequeType: string
	media: string
	status: string
	guaranteeStatus: string
	block: string
	reason: string
	receivers: PichakPerson[]
	signers: PichakPerson[]
}

/** What the registry knows about the drawer, counted per owner of the cheque. */
export interface OwnerRecord {
	idCode: string
	idType: string
	bounced: string
	cleared: string
}

export interface PichakInquiry {
	cheque: PichakCheque | null
	ongoing: string
	blocked: string
	owners: OwnerRecord[]
}

export type InquiryRole = "issuer" | "holder"

const people = (list: {name?: string | number | null; idType?: string | number | null; idCode?: string | number | null}[] | null | undefined): PichakPerson[] =>
	(list ?? []).map((person) => ({name: str(person.name), idType: str(person.idType), idCode: str(person.idCode)}))

/**
 * Asks the central cheque registry (through the bank) about a cheque by its 16-digit Sayyad id. As the drawer
 * ("issuer") you see your own cheque; as the holder you see one you were given. With `ownerCheck` the holder
 * inquiry also returns how many cheques the drawer has bounced and cleared. Throws with the bank's text on a refusal.
 */
export const inquirePichak = async (sayyadId: string, role: InquiryRole, ownerCheck: boolean): Promise<PichakInquiry> => {
	const body = role === "issuer" ? {sayyadId} : {sayyadId, needOwnerInquiry: ownerCheck}
	const data = responseSchema.parse(camelKeys(await apiClient<unknown>(role === "issuer" ? "/Pichak/IssuerInquiry" : "/Pichak/HolderInquiry", {method: "POST", body: JSON.stringify(body)})))
	if (data.isSuccessful === false || !data.response) throw new Error(typeof data.message === "string" ? data.message : "")
	const detail = data.response
	const owner = data.ownerInquiryResult?.result?.data
	return {
		cheque: {
			series: str(detail.seriNo),
			serial: str(detail.serialNo),
			iban: str(detail.iban),
			amount: str(detail.amount),
			dueDate: str(detail.dueDate),
			issueDate: str(detail.issueDate),
			description: str(detail.description),
			bank: [str(detail.bankName), str(detail.bankCode)].filter(Boolean).join(" · "),
			branch: [str(detail.branchName), str(detail.branchCode)].filter(Boolean).join(" · "),
			chequeType: str(detail.chequeType),
			media: str(detail.chequeMedia),
			status: str(detail.chequeStatus),
			guaranteeStatus: str(detail.guaranteeStatus),
			block: str(detail.chequeBlock),
			reason: str(detail.reasonCodeStr),
			receivers: people(detail.wsrecieverInquiryType),
			signers: people(detail.wssignerInquiryType),
		},
		ongoing: str(owner?.onGoing),
		blocked: str(owner?.blocked),
		owners: (owner?.ownersInfo ?? []).map((info) => ({idCode: str(info.idCode), idType: str(info.idType), bounced: str(info.bounced), cleared: str(info.cleared)})),
	}
}

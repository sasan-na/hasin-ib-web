import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toTransactionResult, type TransactionResult} from "@/features/transaction/api/transaction"

const text = z.union([z.string(), z.number()]).nullish()

const plateSchema = z
	.object({leftPart: text, middlePart: text, rightPart: text, textPart: z.string().nullish()})
	.nullish()

export interface Plate {
	left: string
	letter: string
	middle: string
	right: string
}

const toPlate = (plate: z.infer<typeof plateSchema>): Plate | null =>
	plate ? {left: String(plate.leftPart ?? ""), letter: plate.textPart ?? "", middle: String(plate.middlePart ?? ""), right: String(plate.rightPart ?? "")} : null

const listSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	list: z
		.array(z.object({etcSerial: z.string().nullish(), status: z.string().nullish(), balance: z.number().nullish(), carType: z.string().nullish(), carPlate: plateSchema, etcOperations: z.array(z.string()).nullish()}))
		.nullish(),
})

/** What the bank allows doing with a toll tag. */
export type EtcOperation = "EtcBalance" | "EtcInfo" | "EtcCharge" | "EtcTransferCharge" | "EtcInactivation" | "EtcActivation" | "EtcBlock"

export interface Etc {
	serial: string
	status: string
	/** In Rials, when the list already knows it. */
	balance: number | null
	carType: string
	plate: Plate | null
	operations: string[]
}

/** The user's toll tags (ETC). */
export const getEtcList = async (): Promise<Etc[]> => {
	const data = listSchema.parse(camelKeys(await apiClient<unknown>("/ETCList/GetList")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "etc list failed")
	return (data.list ?? []).map((item) => ({
		serial: item.etcSerial ?? "",
		status: item.status ?? "",
		balance: item.balance ?? null,
		carType: item.carType ?? "",
		plate: toPlate(item.carPlate),
		operations: item.etcOperations ?? [],
	}))
}

const balanceSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), balance: z.number().nullish()})

/** The tag's current balance, in Rials. */
export const getEtcBalance = async (serial: string): Promise<number> => {
	const data = balanceSchema.parse(camelKeys(await apiClient<unknown>(`/Etc/GetEtcBalance?serial=${encodeURIComponent(serial)}`)))
	if (data.isSuccessful === false || data.balance === null || data.balance === undefined) throw new Error(data.message ?? "etc balance failed")
	return data.balance
}

const infoSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	info: z
		.object({
			firstName: z.string().nullish(),
			lastName: z.string().nullish(),
			serial: z.string().nullish(),
			type: z.string().nullish(),
			mobileNumber: z.string().nullish(),
			postalCode: z.string().nullish(),
			address: z.string().nullish(),
			car: z.string().nullish(),
			owner: z.string().nullish(),
			nationalCode: z.string().nullish(),
			carPlate: plateSchema,
			status: z.string().nullish(),
			title: z.string().nullish(),
		})
		.nullish(),
})

export interface EtcInfo {
	serial: string
	owner: string
	nationalCode: string
	mobile: string
	postalCode: string
	address: string
	car: string
	type: string
	status: string
	plate: Plate | null
}

/** The registered details of a tag. */
export const getEtcInfo = async (serial: string): Promise<EtcInfo> => {
	const data = infoSchema.parse(camelKeys(await apiClient<unknown>(`/Etc/GetEtcInfo?serial=${encodeURIComponent(serial)}`)))
	if (data.isSuccessful === false || !data.info) throw new Error(data.message ?? "etc info failed")
	const info = data.info
	return {
		serial: info.serial ?? serial,
		owner: info.owner ?? ([info.firstName, info.lastName].filter(Boolean).join(" ") || info.title) ?? "",
		nationalCode: info.nationalCode ?? "",
		mobile: info.mobileNumber ?? "",
		postalCode: info.postalCode ?? "",
		address: info.address ?? "",
		car: info.car ?? "",
		type: info.type ?? "",
		status: info.status ?? "",
		plate: toPlate(info.carPlate),
	}
}

const operation = (path: string, serial: string): Promise<TransactionResult> =>
	apiClient<unknown>(path, {method: "POST", body: JSON.stringify({etcSerial: serial, etcUserName: "", etcPassword: "", nationalCode: ""})}).then(toTransactionResult)

/** Blocks a tag for good. A real change that cannot be undone here: send once per confirmation, never retry automatically. */
export const blockEtc = (serial: string): Promise<TransactionResult> => operation("/Etc/BlockEtc", serial)

/** Deactivates a tag. A real change: send once per confirmation, never retry automatically. */
export const deactivateEtc = (serial: string): Promise<TransactionResult> => operation("/ETCInactivation/DoTransaction", serial)

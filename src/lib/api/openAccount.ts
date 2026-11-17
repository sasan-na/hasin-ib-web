import {z} from "@/lib/zod"

import {apiClient} from "./client"
import {toTransactionResult, type PasswordType, type TransactionResult} from "../../features/transaction/api/transaction"

// ---- What can be opened ------------------------------------------------------------------------

const depositTypesSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	depositTypeList: z.array(z.object({number: z.number(), name: z.string().nullish(), key: z.string().nullish()})).nullish(),
})

export interface DepositType {
	/** The id the profiles are looked up by. */
	id: number
	name: string
}

export const getDepositTypes = async (): Promise<DepositType[]> => {
	const data = depositTypesSchema.parse(await apiClient<unknown>("/OpenAccount/GetOpenAccountTypes"))
	if (data.isSuccessful === false) throw new Error(data.message ?? "deposit types failed")
	return (data.depositTypeList ?? []).map((type) => ({id: type.number, name: type.name ?? ""}))
}

const profilesSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	accountProfileList: z
		.array(
			z.object({
				profileName: z.string().nullish(),
				productCode: z.string(),
				minBalance: z.number().nullish(),
				interestCalcRate: z.number().nullish(),
				stampFee: z.number().nullish(),
				ownerMinAge: z.number().nullish(),
				usageList: z.array(z.object({id: z.number(), name: z.string().nullish()})).nullish(),
				interestList: z
					.array(z.object({fromMonth: z.number().nullish(), toMonth: z.number().nullish(), percentage: z.string().nullish()}))
					.nullish(),
			}),
		)
		.nullish(),
})

export interface AccountProfile {
	/** The bank's product code; this is what is sent when opening. */
	code: string
	name: string
	/** The least the first deposit may be, in Rials. */
	minBalance: number
	stampFee: number
	ownerMinAge: number
	interestRate: number
	usages: {id: number; name: string}[]
	interestTiers: {fromMonth: number; toMonth: number; percentage: string}[]
}

export const getAccountProfiles = async (depositType: number): Promise<AccountProfile[]> => {
	const data = profilesSchema.parse(await apiClient<unknown>(`/OpenAccount/GetAccountProfiles?depositType=${depositType}`))
	if (data.isSuccessful === false) throw new Error(data.message ?? "profiles failed")
	return (data.accountProfileList ?? []).map((profile) => ({
		code: profile.productCode,
		name: profile.profileName ?? "",
		minBalance: profile.minBalance ?? 0,
		stampFee: profile.stampFee ?? 0,
		ownerMinAge: profile.ownerMinAge ?? 0,
		interestRate: profile.interestCalcRate ?? 0,
		usages: (profile.usageList ?? []).map((usage) => ({id: usage.id, name: usage.name ?? ""})),
		interestTiers: (profile.interestList ?? []).map((tier) => ({fromMonth: tier.fromMonth ?? 0, toMonth: tier.toMonth ?? 0, percentage: tier.percentage ?? ""})),
	}))
}

// ---- Contact details and branches --------------------------------------------------------------

const personalInfoSchema = z.object({mobileNumber: z.string().nullish(), emailAddress: z.string().nullish()})

export interface PersonalInfo {
	mobile: string
	email: string
}

/** The mobile number and email the bank already has for the user, to prefill the form. */
export const getPersonalInfo = async (): Promise<PersonalInfo> => {
	const data = personalInfoSchema.parse(await apiClient<unknown>("/OpenAccount"))
	return {mobile: data.mobileNumber ?? "", email: data.emailAddress ?? ""}
}

const branchesSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	branchList: z
		.array(z.object({code: z.string(), name: z.string().nullish(), isEnabled: z.boolean().nullish(), isVisibleToUser: z.boolean().nullish()}))
		.nullish(),
})

export interface Branch {
	code: string
	name: string
}

/** The branches an account can be opened at. */
export const getBranches = async (): Promise<Branch[]> => {
	const data = branchesSchema.parse(await apiClient<unknown>("/BranchPicker/GetBranches"))
	if (data.isSuccessful === false) throw new Error(data.message ?? "branches failed")
	return (data.branchList ?? [])
		.filter((branch) => branch.isEnabled !== false && branch.isVisibleToUser !== false)
		.map((branch) => ({code: branch.code, name: branch.name ?? branch.code}))
}

// ---- Opening ----------------------------------------------------------------------------------

export interface OpenAccountRequest {
	/** The account the first deposit comes from. */
	sourceAccountNumber: string
	/** That account's password or code; omitted when it needs none. */
	sourcePassword: string | null
	sourcePasswordType: PasswordType
	/** In Rials. */
	startAmount: number
	productCode: string
	usageId: number
	branchCode: string
	cardExport: boolean
	email: string
	mobile: string
	stampFee: number
}

/**
 * Opens the account and moves the first deposit. This is a real transaction: it must be sent once per
 * confirmation and never retried automatically. A refusal comes back as a result with `ok: false`.
 */
export const openAccount = async (request: OpenAccountRequest): Promise<TransactionResult> =>
	toTransactionResult(
		await apiClient<unknown>("/OpenAccount/Open", {
			method: "POST",
			body: JSON.stringify({
				accountNumber: request.sourceAccountNumber,
				...(request.sourcePassword ? {accountPin: request.sourcePassword} : {}),
				passwordType: request.sourcePasswordType,
				startAmount: request.startAmount,
				productCode: request.productCode,
				accountUsageId: request.usageId,
				branchCode: request.branchCode,
				isCardExport: request.cardExport,
				emailAddress: request.email,
				mobileNumber: request.mobile,
				stampPrice: request.stampFee,
			}),
		}),
	)

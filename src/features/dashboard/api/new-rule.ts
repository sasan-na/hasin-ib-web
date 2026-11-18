import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const personSchema = z.object({id: z.number(), name: z.string().nullish(), firstName: z.string().nullish(), familyName: z.string().nullish(), imageUrl: z.string().nullish(), isMaster: z.boolean().nullish()})

/** Someone who can take part in an approval rule. */
export interface RulePerson {
	id: number
	/** The username. */
	name: string
	firstName: string
	familyName: string
	imageUrl: string
	isMaster: boolean
}

const toPerson = (item: z.infer<typeof personSchema>): RulePerson => ({id: item.id, name: item.name ?? "", firstName: item.firstName ?? "", familyName: item.familyName ?? "", imageUrl: item.imageUrl ?? "", isMaster: item.isMaster === true})

/** What to call a person: their full name, or their username when the bank has none. */
export const personLabel = (person: RulePerson): string => [person.firstName, person.familyName].filter(Boolean).join(" ") || person.name

const servicesSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), services: z.array(z.object({id: z.number(), name: z.string().nullish()})).nullish()})

export interface RuleService {
	id: number
	name: string
}

/** The kinds of transaction a rule can cover on an account. */
export const getRuleServices = async (accountNumber: string): Promise<RuleService[]> => {
	const data = servicesSchema.parse(camelKeys(await apiClient<unknown>(`/WorkflowInfo/GetServiceList?accountNumber=${encodeURIComponent(accountNumber)}`)))
	if (data.isSuccessful === false) throw new Error(data.message ?? "rule services failed")
	return (data.services ?? []).filter((service) => service.id !== 0).map((service) => ({id: service.id, name: service.name ?? String(service.id)}))
}

const peopleSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), users: z.array(personSchema).nullish()})

/** The people who have access to the account and can start or approve what a rule covers. */
export const getRulePeople = async (accountNumber: string): Promise<RulePerson[]> => {
	const data = peopleSchema.parse(camelKeys(await apiClient<unknown>(`/WorkflowInfo/GetSubuserList?accountNumber=${encodeURIComponent(accountNumber)}`)))
	if (data.isSuccessful === false) throw new Error(data.message ?? "rule people failed")
	return (data.users ?? []).map(toPerson)
}

const signatorsSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), signators: z.array(personSchema).nullish(), hasWithdrawRule: z.boolean().nullish()})

export interface Signatories {
	people: RulePerson[]
	/** The account has a withdrawal rule of its own, which the bank will compare the rule with. */
	hasWithdrawRule: boolean
}

/** Who signs for the account: the last step of every rule, which the user does not choose. */
export const getSignatories = async (accountNumber: string): Promise<Signatories> => {
	const data = signatorsSchema.parse(camelKeys(await apiClient<unknown>(`/WorkflowInfo/GetAccountSignator?accountNumber=${encodeURIComponent(accountNumber)}`)))
	if (data.isSuccessful === false) throw new Error(data.message ?? "signatories failed")
	return {people: (data.signators ?? []).map(toPerson), hasWithdrawRule: data.hasWithdrawRule === true}
}

const levelSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), result: z.union([z.string(), z.number()]).nullish()})

/** How many approval levels a rule may have. */
export const getMaximumLevel = async (): Promise<number> => {
	const data = levelSchema.parse(camelKeys(await apiClient<unknown>("/WorkflowInfo/GetMaximumLevel")))
	const value = Number(data.result)
	return data.isSuccessful === false || !Number.isFinite(value) || value < 1 ? 1 : value
}

/** What a rule keeps about a person besides the amounts: limits to certain destinations and the people who must approve first. The editor carries it through untouched. */
export interface MemberKept {
	cards: string[]
	accounts: string[]
	iban: string[]
	showProgress: boolean
	preLevel: {id: number; name: string}[]
}

export const NOTHING_KEPT: MemberKept = {cards: [], accounts: [], iban: [], showProgress: true, preLevel: []}

export interface RuleMember {
	person: RulePerson
	/** Smallest and largest amount (Rials) this person handles; empty means no limit. */
	min: string
	max: string
	kept?: MemberKept
}

export interface NewRule {
	title: string
	accountNumber: string
	/** The ids the rule covers; every service of the account is sent as the bank's "all" id. */
	serviceIds: number[]
	allServices: boolean
	initiators: {person: RulePerson; kept?: MemberKept}[]
	levels: RuleMember[][]
}

const answerSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish()})

const member = (person: RulePerson, min: string, max: string, kept: MemberKept = NOTHING_KEPT) => ({
	userInfo: {id: person.id, name: person.name, firstName: person.firstName, familyName: person.familyName, imageUrl: person.imageUrl, isMaster: person.isMaster},
	showProgress: kept.showProgress,
	destinationCards: kept.cards,
	destinationAccounts: kept.accounts,
	destinationIban: kept.iban,
	maxRange: max === "" ? null : Number(max),
	minRange: min === "" ? null : Number(min),
})

const body = (rule: NewRule, id?: number): string =>
	JSON.stringify({
		...(id === undefined ? {} : {id}),
		title: rule.title,
		accountNumber: rule.accountNumber,
		serviceIds: rule.allServices ? [0] : rule.serviceIds,
		initiators: rule.initiators.map((item) => member(item.person, "", "", item.kept)),
		levels: rule.levels.map((level, index) => ({
			levelNumber: index + 1,
			levelUsers: level.map((item) => ({...member(item.person, item.min, item.max, item.kept), preLevelUsers: (item.kept ?? NOTHING_KEPT).preLevel.map((pre) => ({id: pre.id, name: pre.name}))})),
		})),
	})

/** Creates an approval rule. A real change: send once per confirmation, never retry automatically. */
export const createRule = async (rule: NewRule): Promise<void> => {
	const data = answerSchema.parse(camelKeys(await apiClient<unknown>("/Workflow/Create", {method: "POST", body: body(rule)})))
	if (data.isSuccessful === false) throw new Error(data.message ?? "rule creation failed")
}

/** Saves a changed rule. The bank deletes the old one and creates it again, so send once per confirmation and never retry. */
export const editRule = async (id: number, rule: NewRule): Promise<void> => {
	const data = answerSchema.parse(camelKeys(await apiClient<unknown>("/Workflow/Edit", {method: "POST", body: body(rule, id)})))
	if (data.isSuccessful === false) throw new Error(data.message ?? "rule edit failed")
}

const keptSchema = z.object({
	userInfo: personSchema,
	showProgress: z.boolean().nullish(),
	maxRange: z.number().nullish(),
	minRange: z.number().nullish(),
	destinationCards: z.array(z.string()).nullish(),
	destinationAccounts: z.array(z.string()).nullish(),
	destinationIban: z.array(z.string()).nullish(),
	preLevelUsers: z.array(z.object({id: z.number(), name: z.string().nullish()})).nullish(),
})

const editSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	workflow: z
		.object({
			title: z.string().nullish(),
			accountNumber: z.string().nullish(),
			serviceIds: z.array(z.number()).nullish(),
			initiators: z.array(keptSchema).nullish(),
			levels: z.array(z.object({levelNumber: z.number().nullish(), levelUsers: z.array(keptSchema).nullish()})).nullish(),
		})
		.nullish(),
})

export interface EditableRule {
	title: string
	accountNumber: string
	/** The bank's "all" id (0) stands for every service. */
	serviceIds: number[]
	initiators: {person: RulePerson; kept: MemberKept}[]
	levels: RuleMember[][]
}

const toKept = (item: z.infer<typeof keptSchema>): MemberKept => ({
	cards: item.destinationCards ?? [],
	accounts: item.destinationAccounts ?? [],
	iban: item.destinationIban ?? [],
	showProgress: item.showProgress !== false,
	preLevel: (item.preLevelUsers ?? []).map((pre) => ({id: pre.id, name: pre.name ?? ""})),
})

/** An existing rule, ready to be changed. */
export const getRuleForEdit = async (id: number): Promise<EditableRule> => {
	const data = editSchema.parse(camelKeys(await apiClient<unknown>(`/Workflow/Get?workflowId=${id}`)))
	const rule = data.workflow
	if (data.isSuccessful === false || !rule || !rule.accountNumber) throw new Error(data.message ?? "rule not found")
	return {
		title: rule.title ?? "",
		accountNumber: rule.accountNumber,
		serviceIds: rule.serviceIds ?? [],
		initiators: (rule.initiators ?? []).map((item) => ({person: toPerson(item.userInfo), kept: toKept(item)})),
		levels: [...(rule.levels ?? [])]
			.sort((a, b) => (a.levelNumber ?? 0) - (b.levelNumber ?? 0))
			.map((level) =>
				(level.levelUsers ?? []).map((item) => ({
					person: toPerson(item.userInfo),
					min: item.minRange == null ? "" : String(item.minRange),
					max: item.maxRange == null ? "" : String(item.maxRange),
					kept: toKept(item),
				})),
			),
	}
}

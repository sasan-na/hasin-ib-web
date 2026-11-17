import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const listSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	totalCount: z.number().nullish(),
	workflows: z
		.array(
			z.object({
				id: z.number(),
				name: z.string().nullish(),
				accountNumber: z.string().nullish(),
				accountName: z.string().nullish(),
				serviceNames: z.array(z.object({id: z.number(), name: z.string().nullish()})).nullish(),
				signatories: z.array(z.string()).nullish(),
				editReason: z.number().nullish(),
			}),
		)
		.nullish(),
})

/** A rule that says who must approve which kinds of transaction on an account. */
export interface WorkflowRule {
	id: number
	name: string
	accountNumber: string
	accountName: string
	services: string[]
	signatories: string[]
	/** Set when something changed (for example the account's withdrawal rule) and the rule must be looked at again. */
	needsReview: boolean
}

export interface WorkflowRulePage {
	rules: WorkflowRule[]
	total: number
}

/** One page of the user's workflow rules. */
export const getWorkflowRules = async (name: string, offset: number, pageSize: number): Promise<WorkflowRulePage> => {
	const data = listSchema.parse(
		camelKeys(await apiClient<unknown>("/Workflow/GetWorkflows", {method: "POST", body: JSON.stringify({pageSize, offset, workflowName: name || undefined})})),
	)
	if (data.isSuccessful === false) throw new Error(data.message ?? "workflow rules failed")
	return {
		total: data.totalCount ?? 0,
		rules: (data.workflows ?? []).map((item) => ({
			id: item.id,
			name: item.name ?? "",
			accountNumber: item.accountNumber ?? "",
			accountName: item.accountName ?? "",
			services: (item.serviceNames ?? []).map((service) => service.name ?? ""),
			signatories: item.signatories ?? [],
			needsReview: item.editReason !== null && item.editReason !== undefined,
		})),
	}
}

const answerSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish()})

const change = async (path: string, id: number): Promise<string> => {
	const data = answerSchema.parse(camelKeys(await apiClient<unknown>(`${path}?workflowId=${String(id)}`)))
	if (data.isSuccessful === false) throw new Error(data.message ?? "workflow rule change failed")
	return data.message ?? ""
}

/** Deletes a rule: transactions it covers no longer need approval. A real change: send once per confirmation. */
export const deleteWorkflowRule = (id: number): Promise<string> => change("/Workflow/Delete", id)

/** Confirms a rule that needed review after a change, so it applies again. A real change: send once per confirmation. */
export const confirmWorkflowRule = (id: number): Promise<string> => change("/Workflow/ConfirmWithdrawRuleSet", id)

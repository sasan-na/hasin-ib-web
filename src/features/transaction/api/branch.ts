import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"

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

/** The bank branches a service can be directed to (opening an account, receiving a card). */
export const getBranches = async (): Promise<Branch[]> => {
	const data = branchesSchema.parse(await apiClient<unknown>("/BranchPicker/GetBranches"))
	if (data.isSuccessful === false) throw new Error(data.message ?? "branches failed")
	return (data.branchList ?? [])
		.filter((branch) => branch.isEnabled !== false && branch.isVisibleToUser !== false)
		.map((branch) => ({code: branch.code, name: branch.name ?? branch.code}))
}

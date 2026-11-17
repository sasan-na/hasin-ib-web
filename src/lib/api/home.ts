import {z} from "@/lib/zod"

import {apiClient} from "./client"

// These endpoints answer camelCase (like Login/Initialize). Fields are optional because the server
// leaves them out for users it has nothing to say about.
const profileSchema = z.object({
	fullName: z.string().nullish(),
	username: z.string().nullish(),
	// A URL to the customer's photo, or "" / null when there is none or the bank hides photos.
	image: z.string().nullish(),
})

const adminMessageSchema = z.object({
	message: z.string().nullish(),
	url: z.string().nullish(),
	showInMainPage: z.boolean().nullish(),
})

const newServiceListSchema = z.object({
	adminMessage: adminMessageSchema.nullish(),
})

export type Profile = z.infer<typeof profileSchema>
export interface AdminMessage {
	message: string
	url: string | null
}

/** Who is signed in: the full name for a main user, the username for a sub-user. */
export const getProfile = async (): Promise<Profile> => profileSchema.parse(await apiClient<unknown>("/Profile/GetUsername"))

/** The bank's message for the home page, or null when there is none to show. */
export const getAdminMessage = async (): Promise<AdminMessage | null> => {
	// The message rides along with the new-services list; only the message is used here.
	const {adminMessage} = newServiceListSchema.parse(await apiClient<unknown>("/NewService/GetList"))
	if (!adminMessage?.message || adminMessage.showInMainPage === false) return null
	return {message: adminMessage.message, url: adminMessage.url || null}
}

import {queryOptions} from "@tanstack/react-query"

import {getAdminMessage, getProfile} from "./home"

export const homeKeys = {
	all: ["home"] as const,
	profile: () => [...homeKeys.all, "profile"] as const,
	adminMessage: () => [...homeKeys.all, "adminMessage"] as const,
}

export const profileOptions = () =>
	queryOptions({
		queryKey: homeKeys.profile(),
		queryFn: getProfile,
		staleTime: 5 * 60_000,
		retry: false,
	})

export const adminMessageOptions = () =>
	queryOptions({
		queryKey: homeKeys.adminMessage(),
		queryFn: getAdminMessage,
		staleTime: 5 * 60_000,
		retry: false,
	})

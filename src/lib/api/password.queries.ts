import {queryOptions} from "@tanstack/react-query"

import {getPasswordRules} from "./password"

export const passwordKeys = {
	rules: () => ["password", "rules"] as const,
}

/** The bank's password policy. It rarely changes, so it is kept for the session. */
export const passwordRulesOptions = () =>
	queryOptions({
		queryKey: passwordKeys.rules(),
		queryFn: getPasswordRules,
		staleTime: Infinity,
		retry: false,
	})

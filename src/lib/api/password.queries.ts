import {queryOptions} from "@tanstack/react-query"

import {getPasswordRules} from "./password"

export const passwordKeys = {
	rules: (language: string) => ["password", "rules", language] as const,
}

/** The bank's password policy (its texts follow the UI language). It rarely changes, so it is kept for the session. */
export const passwordRulesOptions = (language: string) =>
	queryOptions({
		queryKey: passwordKeys.rules(language),
		queryFn: getPasswordRules,
		staleTime: Infinity,
		retry: false,
	})

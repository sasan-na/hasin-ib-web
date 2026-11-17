import {queryOptions} from "@tanstack/react-query"

import {getAccountProfiles, getBranches, getDepositTypes, getPersonalInfo} from "./open-account"

// Names the bank writes (account types, profiles, branches) follow the UI language, so it is part of each key.
export const openAccountKeys = {
	all: ["openAccount"] as const,
	types: (language: string) => [...openAccountKeys.all, "types", language] as const,
	profiles: (depositType: number, language: string) => [...openAccountKeys.all, "profiles", depositType, language] as const,
	personalInfo: () => [...openAccountKeys.all, "personalInfo"] as const,
	branches: (language: string) => [...openAccountKeys.all, "branches", language] as const,
}

export const depositTypesOptions = (language: string) =>
	queryOptions({queryKey: openAccountKeys.types(language), queryFn: getDepositTypes, staleTime: 10 * 60_000, retry: false})

export const accountProfilesOptions = (depositType: number, language: string) =>
	queryOptions({queryKey: openAccountKeys.profiles(depositType, language), queryFn: () => getAccountProfiles(depositType), staleTime: 10 * 60_000, retry: false})

export const personalInfoOptions = () =>
	queryOptions({queryKey: openAccountKeys.personalInfo(), queryFn: getPersonalInfo, staleTime: 5 * 60_000, retry: false})

export const branchesOptions = (language: string) =>
	queryOptions({queryKey: openAccountKeys.branches(language), queryFn: getBranches, staleTime: 10 * 60_000, retry: false})

import {queryOptions} from "@tanstack/react-query"

import {getMenuSection} from "./menu"

// Names and descriptions come from the server in the UI language, so the language is part of the key.
export const menuKeys = {
	all: ["menu"] as const,
	section: (section: string, language: string) => [...menuKeys.all, section, language] as const,
}

export const menuSectionOptions = (section: string, language: string) =>
	queryOptions({queryKey: menuKeys.section(section, language), queryFn: () => getMenuSection(section), staleTime: 60_000, retry: false})

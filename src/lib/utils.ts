import type React from "react"
import {type ClassValue, clsx} from "clsx"
import {twMerge} from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getInitials(firstName: string, lastName: string): string {
	return `${firstName.charAt(0).toUpperCase()}${lastName.charAt(0).toUpperCase()}`
}

export function toTitleCase(str: string): string {
	return str.replace(
		/\w\S*/g,
		(text: string) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
	)
}

export interface RouteEntry {
	path: string
	breadcrumb: string
	icon?: React.ReactElement
}

/**
 * Recursively searches a route object (like `routeMap`) for an entry whose
 * `path` matches `targetPath`.
 */
export function findRouteByPath(routeObj: Record<string, unknown>, targetPath: string): RouteEntry | undefined {
	for (const key in routeObj) {
		const entry = routeObj[key]
		if (typeof entry === 'object' && entry !== null) {
			const candidate = entry as Partial<RouteEntry>
			if (typeof candidate.path === 'string' && candidate.path === targetPath) {
				return candidate as RouteEntry
			}
			const result = findRouteByPath(entry as Record<string, unknown>, targetPath)
			if (result) return result
		}
	}
	return undefined
}

/**
 * Some of the bank's endpoints answer with PascalCase keys and some with camelCase, and a few vary between
 * deployments (the legacy client reads both). This turns every key into camelCase, deeply, so one schema
 * reads either.
 */
export const camelKeys = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(camelKeys)
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key.charAt(0).toLowerCase() + key.slice(1), camelKeys(inner)]))
	}
	return value
}

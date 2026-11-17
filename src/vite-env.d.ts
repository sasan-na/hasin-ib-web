/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** Legacy server API root, e.g. https://ib.radin.tech/api. Defaults to "/api". */
	readonly VITE_API_URL?: string
	/** Where password recovery lives. The sign-in page hides its link while this is unset. */
	readonly VITE_PASSWORD_RECOVERY_URL?: string
	/** "false" turns the dev-only mock server off (to use a real backend). */
	readonly VITE_ENABLE_MSW?: string
	readonly VITE_LOG_LEVEL?: string
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** Legacy server API root, e.g. https://ib.radin.tech/api. Defaults to "/api". */
	readonly VITE_API_URL?: string
	/** Where password recovery lives. The sign-in page hides its link while this is unset. */
	readonly VITE_PASSWORD_RECOVERY_URL?: string
	readonly VITE_LOG_LEVEL?: string
}

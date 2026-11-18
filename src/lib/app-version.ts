/* eslint-disable no-console */

/**
 * Prints which version of the app is running, so a support call can start from it. Always shown, whatever the log level.
 * The version is put in at build time (vite.config.ts); a dev server started before that setting existed just says "unknown".
 */
export const logAppVersion = (): void => {
	const version = typeof __APP_VERSION__ === "undefined" ? "unknown" : __APP_VERSION__
	const built = typeof __APP_BUILD_DATE__ === "undefined" ? "" : ` (built ${__APP_BUILD_DATE__})`
	console.log(`%cApp Version: ${version}${built}`, "color: #4CAF50; font-weight: bold; font-size: 14px;")
}

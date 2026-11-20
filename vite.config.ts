import { readFileSync } from "node:fs"
import path from "path"
import react from "@vitejs/plugin-react"
import basicSsl from "@vitejs/plugin-basic-ssl"
import { defineConfig, loadEnv } from "vite"

const { version } = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8")) as { version: string }

export default defineConfig(({ mode }) => {
	// Dev only: forward same-origin /api calls to a real server (it sends no CORS headers).
	const env = loadEnv(mode, process.cwd(), "VITE_")
	const proxyTarget = env.VITE_DEV_PROXY_TARGET
	return {
	// The version from package.json and the build date, shown in the browser console (src/lib/app-version.ts).
	define: { __APP_VERSION__: JSON.stringify(version), __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
	// VITE_DEV_HTTPS=1 serves the dev server over https with a throwaway certificate: the login encrypts with Web Crypto,
	// which browsers only offer on https or localhost, so a phone or another PC on the network needs it.
	plugins: [react(), ...(env.VITE_DEV_HTTPS === "1" ? [basicSsl()] : [])],
	server: proxyTarget
		? { proxy: { "/api": { target: proxyTarget, changeOrigin: true, secure: true, cookieDomainRewrite: "" } } }
		: undefined,
	build: {
		chunkSizeWarningLimit: 650,
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (!id.includes("node_modules")) return
					if (id.includes("@radix-ui")) return "radix-vendor"
					if (id.includes("lucide-react") || id.includes("react-icons") || id.includes("@remixicon")) return "icons-vendor"
					if (id.includes("react-hook-form") || id.includes("@hookform") || id.includes("/zod/")) return "form-vendor"
					if (id.includes("@tanstack")) return "query-vendor"
					if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("react-router")) return "react-vendor"
				},
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
}
})

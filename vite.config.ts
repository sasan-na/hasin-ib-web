import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

export default defineConfig(({ mode }) => {
	// Dev only: forward same-origin /api calls to a real server (it sends no CORS headers).
	const proxyTarget = loadEnv(mode, process.cwd(), "VITE_").VITE_DEV_PROXY_TARGET
	return {
	plugins: [react()],
	server: proxyTarget
		? { proxy: { "/api": { target: proxyTarget, changeOrigin: true, secure: true, cookieDomainRewrite: "localhost" } } }
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

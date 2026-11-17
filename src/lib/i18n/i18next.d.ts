import type {resources} from "@/lib/i18n"

// Makes t() type-safe: t("common:nonexistent") is a compile error.
declare module "i18next" {
	interface CustomTypeOptions {
		defaultNS: "common"
		resources: (typeof resources)["en"]
	}
}

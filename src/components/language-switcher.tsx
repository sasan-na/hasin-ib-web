import {Languages} from "lucide-react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {LANGUAGE_NATIVE_NAMES, SUPPORTED_LANGUAGES, type SupportedLanguage} from "@/lib/i18n"

// Toggles between the supported languages. The label is the *other* language's own name.
export function LanguageSwitcher({className}: {className?: string}) {
	const {t, i18n} = useTranslation()
	const current = i18n.resolvedLanguage as SupportedLanguage
	const next = SUPPORTED_LANGUAGES.find((l) => l !== current) ?? SUPPORTED_LANGUAGES[0]

	return (
		<Button
			variant="ghost"
			size="sm"
			className={className}
			aria-label={t("language.label")}
			lang={next}
			onClick={() => void i18n.changeLanguage(next)}
		>
			<Languages />
			{LANGUAGE_NATIVE_NAMES[next]}
		</Button>
	)
}

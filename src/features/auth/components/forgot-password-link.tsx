import {useTranslation} from "react-i18next"

import {buttonVariants} from "@/components/ui/button"

/** Link to password recovery; nothing is shown while VITE_PASSWORD_RECOVERY_URL is unset. */
export function ForgotPasswordLink({href}: {href: string | undefined}) {
	const {t} = useTranslation("auth")

	if (!href) return null

	return (
		<a href={href} target="_blank" rel="noopener noreferrer" className={buttonVariants({variant: "link"})}>
			{t("login.forgotPassword")}
		</a>
	)
}

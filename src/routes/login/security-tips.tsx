import {ShieldCheck} from "lucide-react"
import {useTranslation} from "react-i18next"

const TIP_KEYS = ["files", "antivirus", "password", "logout"] as const

/** Safe-use advice carried over from the legacy sign-in page, kept in view beside the form. */
export function SecurityTips() {
	const {t} = useTranslation("auth")

	return (
		<section aria-labelledby="security-tips-title" className="flex flex-col gap-4 text-sm">
			<h2 id="security-tips-title" className="flex items-center gap-2 text-base font-semibold">
				<ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-info" />
				{t("login.tips.title")}
			</h2>
			<ul className="flex flex-col gap-3 leading-relaxed wrap-break-word text-muted-foreground">
				{TIP_KEYS.map((key) => (
					<li key={key}>{t(`login.tips.${key}`)}</li>
				))}
			</ul>
		</section>
	)
}

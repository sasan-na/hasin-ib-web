import {useTranslation} from "react-i18next"

const TIP_KEYS = ["files", "antivirus", "password", "logout"] as const

/** Safe-use advice carried over from the legacy sign-in page, collapsed until the user opens it. */
export function SecurityTips() {
	const {t} = useTranslation("auth")

	return (
		<details className="rounded-md border px-3 text-sm">
			<summary className="flex min-h-11 cursor-pointer items-center font-medium">{t("login.tips.title")}</summary>
			<ul className="list-disc space-y-2 ps-5 pb-3 wrap-break-word text-muted-foreground">
				{TIP_KEYS.map((key) => (
					<li key={key}>{t(`login.tips.${key}`)}</li>
				))}
			</ul>
		</details>
	)
}

import {Check, Circle, X} from "lucide-react"
import {useTranslation} from "react-i18next"

import type {PasswordRule} from "@/lib/api/password"
import {cn} from "@/lib/utils"

interface PasswordRulesProps {
	rules: PasswordRule[]
	/** Keys of the rules the typed password breaks; null until the server has judged it. */
	violations: ReadonlySet<string> | null
}

function RuleLine({message, state}: {message: string; state: "unknown" | "broken" | "met"}) {
	const {t} = useTranslation()
	const Icon = state === "met" ? Check : state === "broken" ? X : Circle
	return (
		<li className="flex items-start gap-2">
			<Icon
				aria-hidden="true"
				className={cn("mt-0.5 size-4 shrink-0", state === "met" && "text-success", state === "broken" && "text-destructive", state === "unknown" && "text-muted-foreground")}
			/>
			<span className={cn("wrap-break-word", state === "unknown" && "text-muted-foreground")}>{message}</span>
			<span className="sr-only">{t(`password.ruleState.${state}`)}</span>
		</li>
	)
}

/** The bank's password rules, each marked met or broken once the server has checked the new password. */
export function PasswordRules({rules, violations}: PasswordRulesProps) {
	const {t} = useTranslation()
	if (rules.length === 0) return null
	const stateOf = (key: string) => (violations === null ? "unknown" : violations.has(key) ? "broken" : "met")

	return (
		<section aria-label={t("password.rulesTitle")} className="flex flex-col gap-2 text-sm">
			<h2 className="font-medium">{t("password.rulesTitle")}</h2>
			<ul className="flex flex-col gap-2">
				{rules.map((rule) => (
					<li key={rule.key}>
						<ul className="flex flex-col gap-2">
							<RuleLine message={rule.message} state={stateOf(rule.key)} />
							{rule.subRules.length > 0 ? (
								<li>
									<ul className="ms-6 flex flex-col gap-2">
										{rule.subRules.map((sub) => (
											// A sub-rule only counts as broken when its parent is (legacy behaviour).
											<RuleLine
												key={sub.key}
												message={sub.message}
												state={violations !== null && !violations.has(rule.key) ? "met" : stateOf(sub.key)}
											/>
										))}
									</ul>
								</li>
							) : null}
						</ul>
					</li>
				))}
			</ul>
		</section>
	)
}

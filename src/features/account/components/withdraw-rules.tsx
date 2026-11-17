import {Fragment} from "react"
import {useTranslation} from "react-i18next"

import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar"
import type {WithdrawRule} from "@/features/account/api/account"

function Connector({label}: {label: string}) {
	return (
		<div className="flex items-center gap-3 text-sm font-medium text-muted-foreground" aria-hidden="true">
			<span className="h-px flex-1 bg-border" />
			{label}
			<span className="h-px flex-1 bg-border" />
		</div>
	)
}

/**
 * Who must sign to withdraw. Any one of the rules is enough ("or"); a rule needs all of its groups ("and");
 * a group needs everyone in it, or at least a stated number of them.
 */
export function WithdrawRules({rules}: {rules: WithdrawRule[]}) {
	const {t} = useTranslation()

	return (
		<div className="flex flex-col gap-3">
			{rules.map((rule, ruleIndex) => (
				<Fragment key={ruleIndex}>
					{ruleIndex > 0 ? <Connector label={t("account.info.or")} /> : null}
					<div className="flex flex-col gap-3 rounded-md border p-4">
						{rule.map((group, groupIndex) => (
							<Fragment key={groupIndex}>
								{groupIndex > 0 ? <Connector label={t("account.info.and")} /> : null}
								<div className="flex flex-col gap-2">
									<p className="text-sm font-medium">
										{group.required === 0 || group.required >= group.members.length
											? t("account.info.allOfThese")
											: t("account.info.atLeast", {count: group.required})}
									</p>
									<ul className="flex flex-wrap gap-2">
										{group.members.map((member, memberIndex) => (
											<li key={memberIndex} className="flex items-center gap-2 rounded-full border bg-muted/60 py-1 ps-1 pe-3 text-sm">
												<Avatar size="sm">
													{member.image ? <AvatarImage src={member.image} alt="" /> : null}
													<AvatarFallback>{member.name.slice(0, 1)}</AvatarFallback>
												</Avatar>
												{member.name}
											</li>
										))}
									</ul>
								</div>
							</Fragment>
						))}
					</div>
				</Fragment>
			))}
		</div>
	)
}

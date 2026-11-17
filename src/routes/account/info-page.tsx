import {useQuery} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight} from "lucide-react"
import {useTranslation} from "react-i18next"
import {Link, Navigate, useSearchParams} from "react-router-dom"

import {CopyButton} from "@/components/copy-button"
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar"
import {Button} from "@/components/ui/button"
import {Skeleton} from "@/components/ui/skeleton"
import {accountInfoOptions, withdrawRulesOptions} from "@/lib/api/account.queries"
import {formatIban, normalizeIban} from "@/lib/format"
import {routeMap} from "@/routing.tsx"

import {RenameField} from "./rename-field"
import {WithdrawRules} from "./withdraw-rules"

/** One account in detail: its numbers, its name (editable), its owners and who must sign to withdraw. */
export default function AccountInfoPage() {
	const {t, i18n} = useTranslation()
	const [params] = useSearchParams()
	const accountId = Number(params.get("accountId"))
	const valid = Number.isInteger(accountId) && accountId > 0

	const info = useQuery({...accountInfoOptions(accountId, i18n.language), enabled: valid})
	const rules = useQuery({...withdrawRulesOptions(accountId, i18n.language), enabled: valid})

	// A missing or mangled id (an old bookmark, a hand-edited address) has nothing to show.
	if (!valid) return <Navigate to={routeMap.account.path} replace />

	// "Back" points toward the start side of the page, which flips with the language direction.
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("account.info.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.account.path}>
						<BackIcon aria-hidden="true" />
						{t("account.info.back")}
					</Link>
				</Button>
			</div>

			<section aria-label={t("account.info.title")} className="overflow-hidden rounded-lg border bg-card">
				{info.isPending ? (
					<div className="flex flex-col gap-3 p-5" aria-hidden="true">
						<Skeleton className="h-6 w-1/2" />
						<Skeleton className="h-6 w-2/3" />
						<Skeleton className="h-6 w-1/3" />
					</div>
				) : info.isError ? (
					<p role="alert" className="p-5 text-sm text-destructive">
						{t("account.info.error")}
					</p>
				) : (
					<>
						<dl className="flex flex-col gap-4 p-5 text-sm">
							<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
								<dt className="w-32 shrink-0 text-muted-foreground">{t("account.number")}</dt>
								<dd dir="ltr" className="flex items-center gap-1 tabular-nums">
									{info.data.number}
									<CopyButton value={info.data.number} label={t("account.copyNumber")} />
								</dd>
							</div>
							{info.data.iban ? (
								<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
									<dt className="w-32 shrink-0 text-muted-foreground">{t("account.iban")}</dt>
									<dd dir="ltr" className="flex items-center gap-1 tabular-nums">
										{formatIban(info.data.iban)}
										<CopyButton value={normalizeIban(info.data.iban)} label={t("account.copyIban")} />
									</dd>
								</div>
							) : null}
							{info.data.type ? (
								<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
									<dt className="w-32 shrink-0 text-muted-foreground">{t("account.info.type")}</dt>
									<dd>{info.data.type}</dd>
								</div>
							) : null}
							<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
								<dt className="w-32 shrink-0 text-muted-foreground">{t("account.info.name")}</dt>
								<dd>
									<RenameField accountId={accountId} name={info.data.name} />
								</dd>
							</div>
						</dl>
						{info.data.owners.length > 0 ? (
							<div className="flex flex-col gap-3 border-t p-5">
								<h2 className="text-base font-semibold">
									{info.data.owners.length > 1 ? t("account.info.owners") : t("account.info.owner")}
								</h2>
								<ul className="flex flex-wrap gap-3">
									{info.data.owners.map((owner, index) => (
										<li key={index} className="flex items-center gap-2 text-sm">
											<Avatar>
												{owner.image ? <AvatarImage src={owner.image} alt="" /> : null}
												<AvatarFallback>{owner.name.slice(0, 1)}</AvatarFallback>
											</Avatar>
											{owner.name}
										</li>
									))}
								</ul>
							</div>
						) : null}
					</>
				)}
			</section>

			{rules.data && rules.data.length > 0 ? (
				<section aria-labelledby="withdraw-rules-title" className="flex flex-col gap-3 rounded-lg border bg-card p-5">
					<h2 id="withdraw-rules-title" className="text-base font-semibold">
						{t("account.info.withdrawRules")}
					</h2>
					<p className="text-sm text-muted-foreground">{t("account.info.withdrawNote")}</p>
					<WithdrawRules rules={rules.data} />
				</section>
			) : null}
		</div>
	)
}

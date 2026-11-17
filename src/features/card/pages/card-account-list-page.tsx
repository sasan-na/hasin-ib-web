import {useQuery} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight, Link2, Link2Off, Plus, Star} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link, Navigate, useSearchParams} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {CopyButton} from "@/components/copy-button"
import {Button} from "@/components/ui/button"
import {Skeleton} from "@/components/ui/skeleton"
import {cardAccountsOptions} from "@/features/card/api/card.queries"
import {CardAccountActionDialog, type CardAccountAction} from "@/features/card/components/card-account-action-dialog"
import {formatCardNumber} from "@/lib/format"

/** The accounts a card draws on: which is the default, and how to change that or unlink one. */
export default function CardAccountListPage() {
	const {t, i18n} = useTranslation()
	const [params] = useSearchParams()
	const cardId = Number(params.get("cardId"))
	const valid = Number.isInteger(cardId) && cardId > 0
	const [action, setAction] = useState<CardAccountAction | null>(null)

	const accounts = useQuery({...cardAccountsOptions(cardId), enabled: valid})

	// A missing or mangled id (an old bookmark, a hand-edited address) has nothing to show.
	if (!valid) return <Navigate to={routeMap.cardList.path} replace />
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-bold">{t("card.accounts.title")}</h1>
					{accounts.data?.cardNumber ? (
						<p dir="ltr" className="text-start text-sm text-muted-foreground tabular-nums">
							{formatCardNumber(accounts.data.cardNumber)}
						</p>
					) : null}
				</div>
				<div className="flex flex-wrap gap-2">
					<Button asChild size="sm">
						<Link to={`${routeMap.cardConnectAccount.path}?cardId=${cardId}`}>
							<Plus aria-hidden="true" />
							{t("card.accounts.connect")}
						</Link>
					</Button>
					<Button asChild variant="outline" size="sm">
						<Link to={routeMap.cardList.path}>
							<BackIcon aria-hidden="true" />
							{t("card.info.back")}
						</Link>
					</Button>
				</div>
			</div>

			<section aria-label={t("card.accounts.title")} className="overflow-hidden rounded-lg border bg-card">
				{accounts.isPending ? (
					<div className="flex flex-col gap-3 p-5" aria-hidden="true">
						<Skeleton className="h-14 w-full" />
						<Skeleton className="h-14 w-full" />
					</div>
				) : accounts.isError ? (
					<p role="alert" className="p-5 text-sm text-destructive">
						{t("card.accounts.error")}
					</p>
				) : accounts.data.accounts.length === 0 ? (
					<p className="p-5 text-sm text-muted-foreground">{t("card.accounts.empty")}</p>
				) : (
					<ul className="divide-y">
						{accounts.data.accounts.map((account) => (
							<li key={account.number} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
								<div className="flex min-w-0 flex-col gap-1">
									<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
										<span dir="ltr" className="flex items-center gap-1 text-base font-semibold tabular-nums">
											{account.number}
											<CopyButton value={account.number} label={t("card.accounts.copyAccount")} />
										</span>
										{account.isDefault ? (
											<span className="flex items-center gap-1 text-sm font-medium text-primary">
												<Star aria-hidden="true" className="size-4" />
												{t("card.accounts.default")}
											</span>
										) : null}
									</div>
									{account.type ? <span className="text-sm text-muted-foreground">{account.type}</span> : null}
								</div>
								{!account.isDefault ? (
									<div className="flex flex-wrap gap-2">
										<Button type="button" variant="outline" size="sm" onClick={() => setAction({kind: "default", account})}>
											<Link2 aria-hidden="true" />
											{t("card.accounts.setDefault")}
										</Button>
										<Button type="button" variant="outline" size="sm" onClick={() => setAction({kind: "disconnect", account})}>
											<Link2Off aria-hidden="true" />
											{t("card.accounts.disconnect")}
										</Button>
									</div>
								) : null}
							</li>
						))}
					</ul>
				)}
			</section>

			{action && accounts.data ? (
				<CardAccountActionDialog
					cardId={cardId}
					cardNumber={accounts.data.cardNumber}
					defaultAccountNumber={accounts.data.defaultAccountNumber}
					action={action}
					onClose={() => setAction(null)}
				/>
			) : null}
		</div>
	)
}

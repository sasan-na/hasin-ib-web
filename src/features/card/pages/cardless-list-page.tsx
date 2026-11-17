import {useQuery} from "@tanstack/react-query"
import {Plus, RefreshCw} from "lucide-react"
import * as React from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Skeleton} from "@/components/ui/skeleton"
import type {CardlessTicket} from "@/features/card/api/cardless"
import {cardlessTicketsOptions} from "@/features/card/api/card.queries"
import {CancelCardlessDialog} from "@/features/card/components/cardless-dialogs"
import {formatAmount, formatCardNumber} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

/** The card-less withdrawal tickets on the user's cards, with a way to cancel the ones nobody has used. */
export default function CardlessListPage() {
	const {t, i18n} = useTranslation()
	const tickets = useQuery(cardlessTicketsOptions())
	const [query, setQuery] = React.useState("")
	const [cancelling, setCancelling] = React.useState<CardlessTicket | null>(null)

	const needle = normalizeDigits(query).trim()
	const visible = (tickets.data?.tickets ?? []).filter((ticket) => needle === "" || [ticket.traceNumber, ticket.mobile, ticket.cardNumber].some((value) => value.includes(needle)))

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("card.cardless.title")}</h1>
				<div className="flex gap-2">
					<Button type="button" variant="outline" size="sm" disabled={tickets.isFetching} onClick={() => void tickets.refetch()}>
						<RefreshCw aria-hidden="true" className={tickets.isFetching ? "animate-spin" : undefined} />
						{t("card.cardless.refresh")}
					</Button>
					<Button asChild size="sm">
						<Link to={routeMap.cardlessNew.path}>
							<Plus aria-hidden="true" />
							{t("card.cardless.newTitle")}
						</Link>
					</Button>
				</div>
			</div>

			<Input type="search" aria-label={t("card.cardless.search")} placeholder={t("card.cardless.search")} value={query} onChange={(event) => setQuery(event.target.value)} />

			{tickets.isPending ? (
				<div className="flex flex-col gap-3" aria-hidden="true">
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-24 w-full" />
				</div>
			) : tickets.isError ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{tickets.error.message || t("card.cardless.loadError")}
				</p>
			) : (
				<>
					{tickets.data.problems.map((problem, index) => (
						<p key={index} role="alert" className="rounded-lg border border-destructive/40 bg-card p-4 text-sm text-destructive">
							{problem.message} <span dir="ltr">({formatCardNumber(problem.cardNumber)})</span>
						</p>
					))}
					{visible.length === 0 ? (
						<p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">{tickets.data.tickets.length === 0 ? t("card.cardless.empty") : t("card.cardless.noMatch")}</p>
					) : (
						<ul className="grid gap-4 md:grid-cols-2">
							{visible.map((ticket) => (
								<li key={`${ticket.cardNumber}-${ticket.traceNumber}`} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
									<dl className="flex flex-col gap-2">
										<Row label={t("card.cardless.traceNumber")} value={ticket.traceNumber} ltr />
										<Row label={t("card.cardless.mobile")} value={ticket.mobile} ltr />
										<Row label={t("card.cardless.card")} value={formatCardNumber(ticket.cardNumber)} ltr />
										<Row label={t("card.cardless.amount")} value={`${formatAmount(ticket.amount, i18n.language)} ${t("card.rial")}`} />
										{ticket.remaining !== null && ticket.remaining !== ticket.amount ? (
											<Row label={t("card.cardless.remaining")} value={`${formatAmount(ticket.remaining, i18n.language)} ${t("card.rial")}`} />
										) : null}
										<Row label={t("card.cardless.date")} value={ticket.date} ltr />
										<Row label={t("card.cardless.status")} value={ticket.status} />
									</dl>
									{ticket.canCancel && ticket.cardId > 0 ? (
										<Button type="button" variant="outline" size="sm" className="self-start text-destructive" onClick={() => setCancelling(ticket)}>
											{t("card.cardless.cancel")}
										</Button>
									) : null}
								</li>
							))}
						</ul>
					)}
				</>
			)}

			{cancelling ? <CancelCardlessDialog ticket={cancelling} onClose={() => setCancelling(null)} /> : null}
		</div>
	)
}

function Row({label, value, ltr = false}: {label: string; value: string; ltr?: boolean}) {
	if (value === "") return null
	return (
		<div className="flex flex-wrap justify-between gap-2 text-sm">
			<dt className="text-muted-foreground">{label}</dt>
			<dd dir={ltr ? "ltr" : undefined} className="font-medium">
				{value}
			</dd>
		</div>
	)
}

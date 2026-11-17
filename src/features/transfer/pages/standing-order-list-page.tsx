import {useQuery} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {Skeleton} from "@/components/ui/skeleton"
import {standingOrdersOptions} from "@/features/transfer/api/transfer.queries"
import type {StandingOrder} from "@/features/transfer/api/standing-order"
import {CancelStandingOrderDialog} from "@/features/transfer/components/cancel-standing-order-dialog"
import {formatAmount} from "@/lib/format"

const PAGE_SIZE = 50

/** The standing orders (regular transfers) set up on the user's accounts, each of which can be stopped. */
export default function StandingOrderListPage() {
	const {t, i18n} = useTranslation()
	const orders = useQuery(standingOrdersOptions(PAGE_SIZE))
	const [cancelling, setCancelling] = useState<StandingOrder | null>(null)

	const row = (label: string, value: string, ltr = false) =>
		value ? (
			<div className="flex flex-wrap justify-between gap-2 text-sm">
				<dt className="text-muted-foreground">{label}</dt>
				<dd dir={ltr ? "ltr" : undefined} className="font-medium">
					{value}
				</dd>
			</div>
		) : null

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("transfer.standing.title")}</h1>

			{orders.isPending ? (
				<div className="flex flex-col gap-3">
					<Skeleton className="h-32 w-full" />
					<Skeleton className="h-32 w-full" />
				</div>
			) : orders.isError ? (
				<div role="alert" className="flex flex-col items-start gap-3 rounded-lg border p-5 text-sm text-destructive">
					{orders.error.message || t("transfer.standing.loadFailed")}
					<Button type="button" variant="outline" onClick={() => void orders.refetch()}>
						{t("transfer.standing.retry")}
					</Button>
				</div>
			) : orders.data.orders.length === 0 ? (
				<p className="rounded-lg border p-5 text-sm text-muted-foreground">{t("transfer.standing.empty")}</p>
			) : (
				<ul className="flex flex-col gap-3">
					{orders.data.orders.map((order) => (
						<li key={`${order.sourceAccountNumber}-${order.code}`} className="flex flex-col gap-3 rounded-lg border bg-card p-5">
							<dl className="flex flex-col gap-2">
								{row(t("transfer.sourceAccount"), order.sourceAccountNumber, true)}
								{row(t("transfer.standing.destination"), order.destinationNumber, true)}
								{row(t("transfer.holderLabel"), order.destinationOwner)}
								{row(t("transfer.standing.amount"), `${formatAmount(order.amount, i18n.language)} ${t("transfer.rial")}`)}
								{row(t("transfer.standing.firstDate"), order.firstDate, true)}
								{row(t("transfer.standing.frequency"), order.frequency)}
								{row(t("transfer.standing.duration"), order.duration)}
								{row(t("transfer.standing.trackingId"), order.code, true)}
								{row(t("transfer.description"), order.description)}
							</dl>
							{order.canCancel ? (
								<div>
									<Button type="button" variant="outline" onClick={() => setCancelling(order)}>
										{t("transfer.standing.cancel")}
									</Button>
								</div>
							) : null}
						</li>
					))}
				</ul>
			)}

			{cancelling ? <CancelStandingOrderDialog order={cancelling} onClose={() => setCancelling(null)} /> : null}
		</div>
	)
}

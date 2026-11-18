import {useMutation, useQuery} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight} from "lucide-react"
import {useTranslation} from "react-i18next"
import {Link, Navigate, useSearchParams} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Skeleton} from "@/components/ui/skeleton"
import {exportStandingOrder, getStandingOrderDetails, type StandingOrderKey} from "@/features/transfer/api/standing-order"
import {formatAmount} from "@/lib/format"
import {saveFile} from "@/lib/save-file"

/** One standing order: its terms and what has happened to each planned transfer. */
export default function StandingOrderDetailsPage() {
	const {t, i18n} = useTranslation()
	const [params] = useSearchParams()
	const key: StandingOrderKey = {
		sourceAccountNumber: (params.get("source") ?? "").trim(),
		destinationNumber: (params.get("destination") ?? "").trim(),
		code: (params.get("code") ?? "").trim(),
	}
	const valid = /^\d{5,30}$/.test(key.sourceAccountNumber) && /^\d{5,30}$/.test(key.destinationNumber) && /^\w{1,40}$/.test(key.code)
	const details = useQuery({queryKey: ["transfer", "standing-order", key], queryFn: () => getStandingOrderDetails(key), enabled: valid, staleTime: 60_000, retry: false})
	const file = useMutation({
		mutationFn: async (format: "pdf" | "excel"): Promise<void> => saveFile(await exportStandingOrder(key, format), `StandingOrder-${key.code}.${format === "pdf" ? "pdf" : "xlsx"}`),
	})
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft
	const money = (value: number): string => `${formatAmount(value, i18n.language)} ${t("transfer.rial")}`

	if (!valid) return <Navigate to={routeMap.transferStandingOrders.path} replace />

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
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("transfer.standing.detailsTitle")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.transferStandingOrders.path}>
						<BackIcon aria-hidden="true" />
						{t("transfer.standing.backToList")}
					</Link>
				</Button>
			</div>

			{details.isPending ? (
				<Skeleton className="h-48 w-full" />
			) : details.isError ? (
				<p role="alert" className="rounded-lg bg-card p-5 text-sm text-destructive">
					{details.error.message || t("transfer.standing.detailsError")}
				</p>
			) : (
				<>
					<section className="flex flex-col gap-3 rounded-lg bg-card p-5">
						<dl className="flex flex-col gap-2">
							{row(t("transfer.sourceAccount"), details.data.sourceAccountNumber, true)}
							{row(t("transfer.standing.destination"), details.data.destinationNumber, true)}
							{row(t("transfer.holderLabel"), details.data.destinationName)}
							{row(t("transfer.amount"), details.data.amount ? money(details.data.amount) : "")}
							{row(t("transfer.standing.frequency"), details.data.frequency)}
							{row(t("transfer.standing.startDate"), details.data.fromDate, true)}
							{row(t("transfer.standing.endDate"), details.data.toDate, true)}
							{row(t("transfer.standing.status"), details.data.status)}
							{row(t("transfer.reason"), details.data.reason)}
							{row(t("transfer.description"), details.data.description)}
						</dl>
						{details.data.duration > 0 ? (
							<p className="text-sm">{t("transfer.standing.summary", {count: details.data.duration, total: money(details.data.totalPaid)})}</p>
						) : null}
					</section>

					<section className="flex flex-col gap-3 rounded-lg bg-card p-5" aria-labelledby="so-history">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<h2 id="so-history" className="text-base font-semibold">
								{t("transfer.standing.history")}
							</h2>
							<div className="flex gap-2">
								<Button type="button" size="sm" variant="outline" disabled={file.isPending} onClick={() => file.mutate("pdf")}>
									PDF
								</Button>
								<Button type="button" size="sm" variant="outline" disabled={file.isPending} onClick={() => file.mutate("excel")}>
									Excel
								</Button>
							</div>
						</div>
						{file.isError ? (
							<p role="alert" className="text-sm text-destructive">
								{t("transfer.standing.exportFailed")}
							</p>
						) : null}
						{details.data.history.length === 0 ? (
							<p className="text-sm text-muted-foreground">{t("transfer.standing.noHistory")}</p>
						) : (
							<div className="overflow-x-auto rounded-md border">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b">
											<th className="p-2 text-start font-medium text-muted-foreground">{t("transfer.standing.trackingId")}</th>
											<th className="p-2 text-start font-medium text-muted-foreground">{t("transfer.standing.dueDate")}</th>
											<th className="p-2 text-start font-medium text-muted-foreground">{t("transfer.standing.paidDate")}</th>
											<th className="p-2 text-start font-medium text-muted-foreground">{t("transfer.standing.status")}</th>
										</tr>
									</thead>
									<tbody>
										{details.data.history.map((item, index) => (
											<tr key={index} className="border-b last:border-0">
												<td dir="ltr" className="p-2 text-start tabular-nums">
													{item.trackingCode}
												</td>
												<td dir="ltr" className="p-2 text-start tabular-nums">
													{item.dueDate}
												</td>
												<td dir="ltr" className="p-2 text-start tabular-nums">
													{item.paidDate}
												</td>
												<td className={item.ok ? "p-2 text-success" : "p-2 text-destructive"}>{item.status}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</section>
				</>
			)}
		</div>
	)
}

import {useQuery} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight, Printer} from "lucide-react"
import {useTranslation} from "react-i18next"
import {Link, Navigate, useSearchParams} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Skeleton} from "@/components/ui/skeleton"
import {DetailValue} from "@/features/dashboard/components/workflow-dialogs"
import {getReceipt} from "@/features/receipt/api/receipt"
import {formatAmount, formatCardNumber} from "@/lib/format"

/** One receipt, laid out to be read or printed (the browser's print dialog can also save it as a PDF). */
export default function ReceiptViewPage() {
	const {t, i18n} = useTranslation()
	const [params] = useSearchParams()
	const id = Number(params.get("id"))
	const typeKey = (params.get("type") ?? "").trim()
	const batchId = params.get("batch") ?? ""
	const isBatch = params.get("isBatch") === "1"
	const valid = Number.isInteger(id) && id > 0 && /^\w{2,80}$/.test(typeKey)

	const receipt = useQuery({queryKey: ["receipt", "view", id, typeKey, batchId, isBatch], queryFn: () => getReceipt({id, typeKey, batchId, isBatch}), enabled: valid, staleTime: 60_000, retry: false})
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft

	if (!valid) return <Navigate to={routeMap.receiptList.path} replace />

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
				<h1 className="text-2xl font-bold">{t("receipt.viewTitle")}</h1>
				<div className="flex flex-wrap gap-2">
					<Button asChild variant="outline" size="sm">
						<Link to={routeMap.receiptList.path}>
							<BackIcon aria-hidden="true" />
							{t("receipt.back")}
						</Link>
					</Button>
					<Button type="button" size="sm" disabled={!receipt.isSuccess} onClick={() => window.print()}>
						<Printer aria-hidden="true" />
						{t("receipt.print")}
					</Button>
				</div>
			</div>

			{receipt.isPending ? (
				<Skeleton className="h-48 w-full" />
			) : receipt.isError ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{receipt.error.message || t("receipt.viewError")}
				</p>
			) : (
				<article className="flex flex-col gap-5 rounded-lg border bg-card p-6 print:border-0 print:p-0">
					<h2 className="text-lg font-semibold">{receipt.data.description || t("receipt.viewTitle")}</h2>
					<dl className="flex flex-col gap-2 text-sm">
						{receipt.data.fields.map((field, index) => (
							<div key={index} className="flex flex-wrap justify-between gap-2 border-b pb-2 last:border-0">
								<dt className="text-muted-foreground">{field.label}</dt>
								<dd className="font-medium wrap-break-word">
									<DetailValue value={field.value} type={field.type} />
									{field.type === "Amount" ? ` ${t("receipt.rial")}` : ""}
								</dd>
							</div>
						))}
					</dl>

					{receipt.data.batch ? (
						<div className="flex flex-col gap-2">
							{receipt.data.batch.title ? <h3 className="text-sm font-semibold">{receipt.data.batch.title}</h3> : null}
							<div className="overflow-x-auto rounded-md border">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b">
											{receipt.data.batch.headers.map((header, index) => (
												<th key={index} className="p-2 text-start font-medium text-muted-foreground">
													{header.label}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{receipt.data.batch.rows.map((row, rowIndex) => (
											<tr key={rowIndex} className="border-b last:border-0">
												{row.values.map((value, index) => {
													const type = receipt.data.batch?.headers[index]?.type ?? "String"
													const shown = type === "Amount" && /^-?\d+$/.test(value) ? `${formatAmount(Number(value), i18n.language)} ${t("receipt.rial")}` : type === "CardPan" ? formatCardNumber(value) : value
													return (
														<td key={index} dir={type === "Iban" || type === "CardPan" ? "ltr" : undefined} className={type === "Status" ? (row.ok ? "p-2 text-success" : "p-2 text-destructive") : "p-2 tabular-nums"}>
															{shown}
														</td>
													)
												})}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					) : null}

					{receipt.data.notes.map((note, index) => (
						<details key={index} className="rounded-md border p-3 text-sm">
							<summary className="cursor-pointer font-medium">{note.label}</summary>
							<p className="mt-2 whitespace-pre-line text-muted-foreground">{note.value}</p>
						</details>
					))}
				</article>
			)}
		</div>
	)
}

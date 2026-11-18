import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {Pencil, Plus, Trash2} from "lucide-react"
import * as React from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle} from "@/components/ui/alert-dialog"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Skeleton} from "@/components/ui/skeleton"
import {removePeriodicInvoice, type PeriodicInvoice} from "@/features/report/api/periodic"
import {periodicInvoicesOptions, periodicKeys, statementFieldsOptions} from "@/features/report/api/periodic.queries"

/** The statements the bank emails the user on a schedule. */
export default function PeriodicListPage() {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const invoices = useQuery(periodicInvoicesOptions())
	const fields = useQuery(statementFieldsOptions(i18n.language))
	const [query, setQuery] = React.useState("")
	const [toRemove, setToRemove] = React.useState<PeriodicInvoice | null>(null)
	const [notice, setNotice] = React.useState<{ok: boolean; text: string} | null>(null)

	const remove = useMutation({
		mutationFn: (id: number) => removePeriodicInvoice(id),
		onSuccess: (result) => {
			setNotice({ok: result.ok, text: result.ok ? t("report.periodic.removed") : result.message || t("report.periodic.removeFailed")})
			setToRemove(null)
			void queryClient.invalidateQueries({queryKey: periodicKeys.list})
		},
		onError: () => {
			setNotice({ok: false, text: t("report.periodic.removeFailed")})
			setToRemove(null)
		},
	})

	const needle = query.trim().toLowerCase()
	const visible = (invoices.data ?? []).filter((invoice) => needle === "" || [invoice.email, invoice.accountNumber, invoice.intervalName].some((value) => value.toLowerCase().includes(needle)))
	const titleOf = (key: string): string => fields.data?.find((field) => field.key === key)?.title ?? key

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("report.periodic.title")}</h1>
				<Button asChild size="sm">
					<Link to={routeMap.reportPeriodicNew.path}>
						<Plus aria-hidden="true" />
						{t("report.periodic.newTitle")}
					</Link>
				</Button>
			</div>
			<p className="text-sm text-muted-foreground">{t("report.periodic.intro")}</p>

			<Input type="search" aria-label={t("report.periodic.search")} placeholder={t("report.periodic.search")} value={query} onChange={(event) => setQuery(event.target.value)} />

			{notice ? (
				<p role={notice.ok ? "status" : "alert"} className={`rounded-lg bg-card p-4 text-sm ${notice.ok ? "" : "text-destructive"}`}>
					{notice.text}
				</p>
			) : null}

			{invoices.isPending ? (
				<div className="flex flex-col gap-3" aria-hidden="true">
					<Skeleton className="h-28 w-full" />
					<Skeleton className="h-28 w-full" />
				</div>
			) : invoices.isError ? (
				<p role="alert" className="rounded-lg bg-card p-5 text-sm text-destructive">
					{invoices.error.message || t("report.periodic.loadError")}
				</p>
			) : visible.length === 0 ? (
				<p className="rounded-lg bg-card p-5 text-sm text-muted-foreground">{invoices.data.length === 0 ? t("report.periodic.empty") : t("report.periodic.noMatch")}</p>
			) : (
				<ul className="grid gap-4 md:grid-cols-2">
					{visible.map((invoice) => (
						<li key={invoice.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
							<div className="flex items-start justify-between gap-2">
								<div className="flex min-w-0 flex-col gap-1">
									<span dir="ltr" className="text-sm font-semibold">
										{invoice.accountNumber}
									</span>
									<span dir="ltr" className="truncate text-sm text-muted-foreground">
										{invoice.email}
									</span>
								</div>
								<div className="flex shrink-0">
									<Button asChild variant="ghost" size="icon" aria-label={t("report.periodic.edit")}>
										<Link to={`${routeMap.reportPeriodicEdit.path}?id=${String(invoice.id)}`}>
											<Pencil aria-hidden="true" />
										</Link>
									</Button>
									<Button type="button" variant="ghost" size="icon" className="text-destructive" aria-label={t("report.periodic.remove")} onClick={() => setToRemove(invoice)}>
										<Trash2 aria-hidden="true" />
									</Button>
								</div>
							</div>
							<dl className="flex flex-col gap-1 text-sm">
								<div className="flex justify-between gap-2">
									<dt className="text-muted-foreground">{t("report.periodic.interval")}</dt>
									<dd>{invoice.intervalName}</dd>
								</div>
								<div className="flex justify-between gap-2">
									<dt className="text-muted-foreground">{t("report.periodic.firstDate")}</dt>
									<dd dir="ltr">{invoice.firstDateText}</dd>
								</div>
								<div className="flex justify-between gap-2">
									<dt className="text-muted-foreground">{t("report.periodic.language")}</dt>
									<dd>{invoice.language === "en-US" ? t("report.periodic.english") : t("report.periodic.persian")}</dd>
								</div>
							</dl>
							{invoice.fields.length > 0 ? <p className="text-xs text-muted-foreground">{invoice.fields.map(titleOf).join("، ")}</p> : null}
						</li>
					))}
				</ul>
			)}

			<AlertDialog open={toRemove !== null} onOpenChange={(open) => !open && !remove.isPending && setToRemove(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("report.periodic.removeTitle")}</AlertDialogTitle>
						<AlertDialogDescription>{t("report.periodic.removeQuestion", {email: toRemove?.email ?? ""})}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={remove.isPending}>{t("report.periodic.cancel")}</AlertDialogCancel>
						<Button type="button" variant="destructive" disabled={remove.isPending} onClick={() => toRemove && remove.mutate(toRemove.id)}>
							{remove.isPending ? t("report.periodic.removing") : t("report.periodic.remove")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}

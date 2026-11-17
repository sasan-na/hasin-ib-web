import {useInfiniteQuery, useQuery} from "@tanstack/react-query"
import {History, RefreshCw, ShieldBan} from "lucide-react"
import * as React from "react"
import {Link} from "react-router-dom"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {Badge} from "@/components/ui/badge"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import type {Cheque, ChequeFilter} from "@/features/cheque/api/cheque"
import {chequeSeriesOptions, chequeStatusesOptions, chequesOptions} from "@/features/cheque/api/cheque.queries"
import {BlockChequeDialog, ChequeHistoryDialog, ConfirmChequeAmountDialog, PichakInquiryDialog} from "@/features/cheque/components/cheque-dialogs"
import type {SourceAccount} from "@/features/transaction/api/transaction"
import {SourceAccountSelect} from "@/features/transaction/components/source-account-select"
import {normalizeDigits} from "@/lib/normalize-digits"

// The bank's name for the cheque list: which accounts may be browsed.
const SERVICE = "ChequeDetails"
const ALL = "all"

/** The cheques of a current account: paper or digital, filtered by status, series or serial, with history and blocking. */
export default function ChequeListPage() {
	const {t, i18n} = useTranslation()
	const statuses = useQuery(chequeStatusesOptions(i18n.language))
	const [account, setAccount] = React.useState<SourceAccount | null>(null)
	const [media, setMedia] = React.useState<"1" | "2">("1")
	const [statusKey, setStatusKey] = React.useState("")
	const [series, setSeries] = React.useState("")
	const [serial, setSerial] = React.useState("")
	const [serialInput, setSerialInput] = React.useState("")
	const [history, setHistory] = React.useState<Cheque | null>(null)
	const [blocking, setBlocking] = React.useState<Cheque | null>(null)
	const [inquiring, setInquiring] = React.useState<Cheque | null>(null)
	const [confirmingAmount, setConfirmingAmount] = React.useState<Cheque | null>(null)

	const filter: ChequeFilter = {accountNumber: account?.number ?? "", media, statusKey, series, serial}
	const list = useInfiniteQuery(chequesOptions(filter, account !== null))
	const seriesList = useQuery(chequeSeriesOptions(filter.accountNumber, account !== null && list.isSuccess))
	const cheques = list.data?.pages.flatMap((page) => page.cheques) ?? []
	const seriesChoices = media === "1" ? (seriesList.data?.paper ?? []) : (seriesList.data?.digital ?? [])

	const changeAccount = (next: SourceAccount | null): void => {
		setAccount(next)
		setStatusKey("")
		setSeries("")
		setSerial("")
		setSerialInput("")
	}

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("cheque.title")}</h1>
				<div className="flex flex-wrap gap-2">
					<Button asChild size="sm" variant="outline">
						<Link to={routeMap.pichakInquiry.path}>{t("cheque.pichak.title")}</Link>
					</Button>
					<Button asChild size="sm" variant="outline">
						<Link to={routeMap.chequeBook.path}>{t("cheque.book.title")}</Link>
					</Button>
				</div>
			</div>

			<section className="flex flex-col gap-4 rounded-lg border bg-card p-5">
				<div className="flex flex-col gap-2">
					<Label htmlFor="cheque-account">{t("cheque.account")}</Label>
					<SourceAccountSelect id="cheque-account" serviceName={SERVICE} value={account?.id ?? null} onChange={changeAccount} />
				</div>

				{account ? (
					<>
						<div className="flex gap-2" role="group" aria-label={t("cheque.media")}>
							<Button type="button" size="sm" variant={media === "1" ? "default" : "outline"} aria-pressed={media === "1"} onClick={() => setMedia("1")}>
								{t("cheque.paper")}
							</Button>
							<Button type="button" size="sm" variant={media === "2" ? "default" : "outline"} aria-pressed={media === "2"} onClick={() => setMedia("2")}>
								{t("cheque.digital")}
							</Button>
						</div>
						<div className="grid gap-3 sm:grid-cols-3">
							<div className="flex flex-col gap-2">
								<Label htmlFor="cheque-status">{t("cheque.status")}</Label>
								<Select value={statusKey === "" ? ALL : statusKey} onValueChange={(value) => setStatusKey(value === ALL ? "" : value)}>
									<SelectTrigger id="cheque-status" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL}>{t("cheque.all")}</SelectItem>
										{(statuses.data ?? []).filter((status) => status.key !== "All").map((status) => (
											<SelectItem key={status.key} value={status.key}>
												{status.title}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-2">
								<Label htmlFor="cheque-series">{t("cheque.series")}</Label>
								<Select value={series === "" ? ALL : series} onValueChange={(value) => setSeries(value === ALL ? "" : value)}>
									<SelectTrigger id="cheque-series" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL}>{t("cheque.all")}</SelectItem>
										{seriesChoices.map((choice) => (
											<SelectItem key={choice} value={choice}>
												{choice}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<form
								className="flex flex-col gap-2"
								onSubmit={(event) => {
									event.preventDefault()
									setSerial(serialInput)
								}}
							>
								<Label htmlFor="cheque-serial">{t("cheque.serial")}</Label>
								<Input
									id="cheque-serial"
									dir="ltr"
									inputMode="numeric"
									autoComplete="off"
									value={serialInput}
									onChange={(event) => setSerialInput(normalizeDigits(event.target.value).replace(/\D/g, ""))}
									onBlur={() => setSerial(serialInput)}
								/>
							</form>
						</div>
					</>
				) : null}
			</section>

			{account === null ? (
				<p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">{t("cheque.chooseAccount")}</p>
			) : list.isPending ? (
				<div className="flex flex-col gap-3" aria-hidden="true">
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
				</div>
			) : list.isError ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{list.error.message || t("cheque.error")}
				</p>
			) : (
				<>
					<div className="flex justify-end">
						<Button type="button" variant="outline" size="sm" disabled={list.isFetching} onClick={() => void list.refetch()}>
							<RefreshCw aria-hidden="true" className={list.isFetching ? "animate-spin" : undefined} />
							{t("cheque.refresh")}
						</Button>
					</div>
					{cheques.length === 0 ? (
						<p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">{t("cheque.empty")}</p>
					) : (
						<ul className="flex flex-col gap-3">
							{cheques.map((cheque) => (
								<li key={`${cheque.series}-${cheque.serial}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
									<div className="flex min-w-0 flex-col gap-1">
										<span className="text-sm font-semibold" dir="ltr">
											{cheque.series} / {cheque.serial}
										</span>
										{cheque.sayyadId ? (
											<span className="text-xs text-muted-foreground" dir="ltr">
												{t("cheque.sayyadId")}: {cheque.sayyadId}
											</span>
										) : null}
										{cheque.expiry ? (
											<span className="text-xs text-muted-foreground">
												{t("cheque.expiry")}: <span dir="ltr">{cheque.expiry}</span>
											</span>
										) : null}
									</div>
									<div className="flex flex-wrap items-center gap-2">
										<Badge variant="secondary">{cheque.status}</Badge>
										{cheque.canSeeHistory ? (
											<Button type="button" variant="ghost" size="sm" onClick={() => setHistory(cheque)}>
												<History aria-hidden="true" />
												{t("cheque.history.action")}
											</Button>
										) : null}
										{cheque.canRegister && account ? (
											<Button asChild variant="ghost" size="sm">
												<Link to={`${routeMap.pichakRegister.path}?account=${String(account.id)}&series=${encodeURIComponent(cheque.series)}&serial=${encodeURIComponent(cheque.serial)}&sayyad=${encodeURIComponent(cheque.sayyadId)}`}>{t("cheque.register.action")}</Link>
											</Button>
										) : null}
										{cheque.canInquire ? (
											<Button type="button" variant="ghost" size="sm" onClick={() => setInquiring(cheque)}>
												{t("cheque.pichak.action")}
											</Button>
										) : null}
										{cheque.canConfirmAmount ? (
											<Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingAmount(cheque)}>
												{t("cheque.confirmAmount.action")}
											</Button>
										) : null}
										{cheque.canBlock ? (
											<Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setBlocking(cheque)}>
												<ShieldBan aria-hidden="true" />
												{t("cheque.block.action")}
											</Button>
										) : null}
									</div>
								</li>
							))}
						</ul>
					)}
					{list.hasNextPage ? (
						<div className="flex justify-center">
							<Button type="button" variant="outline" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
								{list.isFetchingNextPage ? t("cheque.loading") : t("cheque.more")}
							</Button>
						</div>
					) : null}
				</>
			)}

			{account && history ? <ChequeHistoryDialog account={account} cheque={history} onClose={() => setHistory(null)} /> : null}
			{inquiring ? <PichakInquiryDialog cheque={inquiring} onClose={() => setInquiring(null)} /> : null}
			{account && confirmingAmount ? <ConfirmChequeAmountDialog account={account} cheque={confirmingAmount} onClose={() => setConfirmingAmount(null)} /> : null}
			{account && blocking ? <BlockChequeDialog account={account} cheque={blocking} onClose={() => setBlocking(null)} /> : null}
		</div>
	)
}

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {Plus, Trash2} from "lucide-react"
import * as React from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle} from "@/components/ui/alert-dialog"
import {Button} from "@/components/ui/button"
import {Checkbox} from "@/components/ui/checkbox"
import {Input} from "@/components/ui/input"
import {Skeleton} from "@/components/ui/skeleton"
import {getMobileBill, removeSavedBill, type PayableBill, type SavedBill} from "@/features/bill/api/bill"
import {billKeys, savedBillsOptions} from "@/features/bill/api/bill.queries"
import {PayBillsDialog} from "@/features/bill/components/pay-bills-dialog"
import {amountOfPayId, billKindOf, isPayIdValid, type BillKind} from "@/features/bill/lib/bill-codes"
import {formatAmount} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

const KIND_ORDER: BillKind[] = ["water", "electricity", "gas", "phone", "mobile", "municipality", "other"]

const kindOf = (bill: SavedBill): BillKind | "unknown" => (bill.mobile ? "mobile" : (billKindOf(bill.billId) ?? "unknown"))

/** The bills the user has paid before, grouped by kind, ready to be paid again. */
export default function BillListPage() {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const saved = useQuery(savedBillsOptions())
	const [query, setQuery] = React.useState("")
	const [selected, setSelected] = React.useState<Set<number>>(() => new Set())
	const [payIds, setPayIds] = React.useState<Record<number, string>>({})
	const [preparing, setPreparing] = React.useState(false)
	const [problem, setProblem] = React.useState<string | null>(null)
	const [paying, setPaying] = React.useState<PayableBill[] | null>(null)
	const [toRemove, setToRemove] = React.useState<SavedBill | null>(null)
	const [notice, setNotice] = React.useState<{ok: boolean; text: string} | null>(null)

	const remove = useMutation({
		mutationFn: (id: number) => removeSavedBill(id),
		onSuccess: (result) => {
			setNotice({ok: result.ok, text: result.ok ? t("bill.removed") : result.message || t("bill.removeFailed")})
			setToRemove(null)
			void queryClient.invalidateQueries({queryKey: billKeys.saved})
		},
		onError: () => {
			setNotice({ok: false, text: t("bill.removeFailed")})
			setToRemove(null)
		},
	})

	const needle = query.trim().toLowerCase()
	const bills = (saved.data ?? []).filter((bill) => needle === "" || [bill.billId, bill.mobile, bill.title].some((value) => value.toLowerCase().includes(needle)))
	const groups = [...KIND_ORDER, "unknown" as const]
		.map((kind) => ({kind, bills: bills.filter((bill) => kindOf(bill) === kind)}))
		.filter((group) => group.bills.length > 0)

	const toggle = (id: number, on: boolean): void =>
		setSelected((current) => {
			const next = new Set(current)
			if (on) next.add(id)
			else next.delete(id)
			return next
		})

	const payAll = async (): Promise<void> => {
		setProblem(null)
		setNotice(null)
		const chosen = (saved.data ?? []).filter((bill) => selected.has(bill.id))
		const lacking = chosen.find((bill) => !bill.mobile && !isPayIdValid(payIds[bill.id] ?? "", bill.billId))
		if (lacking) {
			setProblem(t("bill.error.payIdFor", {bill: lacking.title || lacking.billId}))
			return
		}
		setPreparing(true)
		try {
			const ready: PayableBill[] = []
			for (const bill of chosen) {
				if (bill.mobile) {
					const found = await getMobileBill(bill.mobile)
					if (found.isPaid) {
						setProblem(t("bill.error.alreadyPaid", {bill: bill.title || bill.mobile}))
						return
					}
					ready.push({billId: found.billId, payId: found.payId, mobile: bill.mobile, amount: amountOfPayId(found.payId), title: bill.title})
				} else {
					const payId = payIds[bill.id] ?? ""
					ready.push({billId: bill.billId, payId, mobile: "", amount: amountOfPayId(payId), title: bill.title})
				}
			}
			setPaying(ready)
		} catch (error) {
			setProblem(error instanceof Error && error.message ? error.message : t("bill.error.lookup"))
		} finally {
			setPreparing(false)
		}
	}

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("bill.title")}</h1>
				<Button asChild size="sm">
					<Link to={routeMap.billNew.path}>
						<Plus aria-hidden="true" />
						{t("bill.newTitle")}
					</Link>
				</Button>
			</div>

			<Input type="search" aria-label={t("bill.search")} placeholder={t("bill.search")} value={query} onChange={(event) => setQuery(event.target.value)} />

			{notice ? (
				<p role={notice.ok ? "status" : "alert"} className={`rounded-lg bg-card p-4 text-sm ${notice.ok ? "" : "text-destructive"}`}>
					{notice.text}
				</p>
			) : null}

			{saved.isPending ? (
				<div className="flex flex-col gap-3" aria-hidden="true">
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-20 w-full" />
				</div>
			) : saved.isError ? (
				<p role="alert" className="rounded-lg bg-card p-5 text-sm text-destructive">
					{saved.error.message || t("bill.error.load")}
				</p>
			) : groups.length === 0 ? (
				<p className="rounded-lg bg-card p-5 text-sm text-muted-foreground">{saved.data.length === 0 ? t("bill.empty") : t("bill.noMatch")}</p>
			) : (
				<>
					{groups.map((group) => (
						<section key={group.kind} aria-label={t(`bill.kind.${group.kind}`)} className="flex flex-col gap-3">
							<h2 className="text-base font-semibold">{t(`bill.kind.${group.kind}`)}</h2>
							<ul className="flex flex-col gap-3">
								{group.bills.map((bill) => {
									const payId = payIds[bill.id] ?? ""
									const payIdBad = payId !== "" && !isPayIdValid(payId, bill.billId)
									return (
										<li key={bill.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
											<div className="flex items-start gap-3">
												<Checkbox checked={selected.has(bill.id)} aria-label={t("bill.select", {bill: bill.title || bill.billId})} onCheckedChange={(on) => toggle(bill.id, on === true)} />
												<div className="flex min-w-0 flex-1 flex-col gap-1">
													{bill.title ? <span className="text-sm font-semibold">{bill.title}</span> : null}
													<span className="text-sm text-muted-foreground" dir="ltr">
														{bill.mobile || bill.billId}
													</span>
												</div>
												<Button type="button" variant="ghost" size="icon" className="text-destructive" aria-label={t("bill.remove")} onClick={() => setToRemove(bill)}>
													<Trash2 aria-hidden="true" />
												</Button>
											</div>
											{bill.mobile ? (
												<p className="text-xs text-muted-foreground">{t("bill.mobileHint")}</p>
											) : (
												<div className="flex flex-col gap-1">
													<Input
														dir="ltr"
														inputMode="numeric"
														autoComplete="off"
														maxLength={13}
														aria-label={t("bill.payId")}
														placeholder={t("bill.payId")}
														value={payId}
														aria-invalid={payIdBad}
														onChange={(event) => setPayIds((current) => ({...current, [bill.id]: normalizeDigits(event.target.value).replace(/\D/g, "")}))}
													/>
													{payId !== "" && !payIdBad ? <span className="text-xs text-muted-foreground">{t("bill.amountIs", {amount: `${formatAmount(amountOfPayId(payId), i18n.language)} ${t("bill.rial")}`})}</span> : null}
													{payIdBad ? <span className="text-xs text-destructive">{t("bill.error.payId")}</span> : null}
												</div>
											)}
										</li>
									)
								})}
							</ul>
						</section>
					))}
					{problem ? (
						<p role="alert" className="text-sm text-destructive">
							{problem}
						</p>
					) : null}
					<div>
						<Button type="button" disabled={selected.size === 0 || preparing} onClick={() => void payAll()}>
							{preparing ? t("bill.preparing") : t("bill.paySelected", {count: selected.size})}
						</Button>
					</div>
				</>
			)}

			{paying ? <PayBillsDialog bills={paying} remember onClose={() => setPaying(null)} /> : null}

			<AlertDialog open={toRemove !== null} onOpenChange={(open) => !open && !remove.isPending && setToRemove(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("bill.removeTitle")}</AlertDialogTitle>
						<AlertDialogDescription>{t("bill.removeQuestion", {bill: toRemove ? toRemove.title || toRemove.mobile || toRemove.billId : ""})}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={remove.isPending}>{t("bill.cancel")}</AlertDialogCancel>
						<Button type="button" variant="destructive" disabled={remove.isPending} onClick={() => toRemove && remove.mutate(toRemove.id)}>
							{remove.isPending ? t("bill.removing") : t("bill.remove")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}

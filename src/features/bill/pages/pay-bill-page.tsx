import * as React from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {FieldError, FlowLayout, FlowSummary, StepSection} from "@/components/flow/flow-form"
import {Button} from "@/components/ui/button"
import {Checkbox} from "@/components/ui/checkbox"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {getMobileBill, importBills, type ImportedBill, type PayableBill} from "@/features/bill/api/bill"
import {PayBillsDialog} from "@/features/bill/components/pay-bills-dialog"
import {amountOfPayId, billKindOf, isBillIdValid, isPayIdValid} from "@/features/bill/lib/bill-codes"
import {formatAmount} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"
import {cn} from "@/lib/utils"

type Mode = "ids" | "mobile" | "file"

const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")

/** Pays a bill that is not in the saved list yet: by its bill and payment ids, or by a mobile number. */
export default function PayBillPage() {
	const {t, i18n} = useTranslation()
	const [mode, setMode] = React.useState<Mode>("ids")
	const [billId, setBillId] = React.useState("")
	const [payId, setPayId] = React.useState("")
	const [mobile, setMobile] = React.useState("")
	const [title, setTitle] = React.useState("")
	const [remember, setRemember] = React.useState(true)
	const [preparing, setPreparing] = React.useState(false)
	const [problem, setProblem] = React.useState<string | null>(null)
	const [paying, setPaying] = React.useState<PayableBill[] | null>(null)
	const [imported, setImported] = React.useState<ImportedBill[]>([])
	const [importing, setImporting] = React.useState(false)

	const billOk = isBillIdValid(billId)
	const payOk = billOk && isPayIdValid(payId, billId)
	const mobileOk = /^09\d{9}$/.test(mobile)
	const kind = billOk ? billKindOf(billId) : null
	// A row from the file is good when its ids are valid and agree with each other (as when typed).
	const importedGood = imported.filter((row) => isBillIdValid(row.billId) && isPayIdValid(row.payId, row.billId))
	const ready = mode === "ids" ? payOk : mode === "mobile" ? mobileOk : importedGood.length > 0

	const readFile = async (file: File): Promise<void> => {
		setImporting(true)
		setProblem(null)
		try {
			const rows = await importBills(file)
			setImported(rows)
			if (rows.length === 0) setProblem(t("bill.import.empty"))
		} catch (error) {
			setImported([])
			setProblem(error instanceof Error && error.message ? error.message : t("bill.import.failed"))
		} finally {
			setImporting(false)
		}
	}

	const review = async (): Promise<void> => {
		setProblem(null)
		if (!ready) return
		if (mode === "file") {
			setPaying(importedGood.map((row) => ({billId: row.billId, payId: row.payId, mobile: "", amount: amountOfPayId(row.payId), title: title.trim()})))
			return
		}
		if (mode === "ids") {
			setPaying([{billId, payId, mobile: "", amount: amountOfPayId(payId), title: title.trim()}])
			return
		}
		setPreparing(true)
		try {
			const found = await getMobileBill(mobile)
			if (found.isPaid) {
				setProblem(t("bill.error.alreadyPaid", {bill: mobile}))
				return
			}
			setPaying([{billId: found.billId, payId: found.payId, mobile, amount: amountOfPayId(found.payId), title: title.trim()}])
		} catch (error) {
			setProblem(error instanceof Error && error.message ? error.message : t("bill.error.lookup"))
		} finally {
			setPreparing(false)
		}
	}

	const modeLabel = mode === "ids" ? t("bill.byIds") : mode === "mobile" ? t("bill.byMobile") : t("bill.byFile")
	const total = mode === "ids" ? (payOk ? amountOfPayId(payId) : 0) : mode === "file" ? importedGood.reduce((sum, row) => sum + amountOfPayId(row.payId), 0) : 0
	const detailRow =
		mode === "ids"
			? {label: t("bill.billId"), value: billOk ? billId : null}
			: mode === "mobile"
				? {label: t("bill.mobile"), value: mobileOk ? mobile : null}
				: {label: t("bill.count"), value: importedGood.length > 0 ? formatAmount(importedGood.length, i18n.language) : null}

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault()
				void review()
			}}
		>
			<FlowLayout
				title={t("bill.newTitle")}
				aside={
					<FlowSummary
						id="bill-summary"
						title={t("bill.summary")}
						amount={total > 0 ? `${formatAmount(total, i18n.language)} ${t("bill.rial")}` : null}
						rows={[{label: t("bill.mode"), value: modeLabel}, detailRow, {label: t("bill.kindLabel"), value: kind ? t(`bill.kind.${kind}`) : null}]}
						reviewLabel={preparing ? t("bill.preparing") : t("bill.review")}
						onReview={() => void review()}
					/>
				}
			>
				<StepSection id="bill-mode" step={1} title={t("bill.mode")}>
					<div role="group" aria-label={t("bill.mode")} className="grid gap-3 sm:grid-cols-3">
						{(["ids", "mobile", "file"] as const).map((option) => (
							<button
								key={option}
								type="button"
								aria-pressed={mode === option}
								onClick={() => setMode(option)}
								className={cn(
									"min-h-11 rounded-xl border bg-card p-4 text-start text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
									mode === option ? "border-primary bg-primary-soft ring-2 ring-primary/20" : "hover:border-foreground/40",
								)}
							>
								{option === "ids" ? t("bill.byIds") : option === "mobile" ? t("bill.byMobile") : t("bill.byFile")}
							</button>
						))}
					</div>
				</StepSection>

				<StepSection id="bill-details" step={2} title={t("bill.detailsStep")}>
					{mode === "ids" ? (
						<>
							<div className="flex flex-col gap-2">
								<Label htmlFor="bill-id">{t("bill.billId")}</Label>
								<Input id="bill-id" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={13} className="h-11 text-base" value={billId} aria-invalid={billId !== "" && !billOk} aria-describedby={billId !== "" && !billOk ? "bill-id-error" : undefined} onChange={(event) => setBillId(digits(event.target.value))} />
								{billId !== "" && !billOk ? <FieldError id="bill-id-error">{t("bill.error.billId")}</FieldError> : null}
							</div>
							<div className="flex flex-col gap-2">
								<Label htmlFor="pay-id">{t("bill.payId")}</Label>
								<Input id="pay-id" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={13} className="h-11 text-base" value={payId} aria-invalid={payId !== "" && !payOk} aria-describedby={payId !== "" && !payOk ? "pay-id-error" : undefined} onChange={(event) => setPayId(digits(event.target.value))} />
								{payId !== "" && !payOk ? <FieldError id="pay-id-error">{t("bill.error.payId")}</FieldError> : null}
								{payOk ? <p className="text-sm font-medium">{t("bill.amountIs", {amount: `${formatAmount(amountOfPayId(payId), i18n.language)} ${t("bill.rial")}`})}</p> : null}
							</div>
						</>
					) : mode === "file" ? (
						<div className="flex flex-col gap-3">
							<Label htmlFor="bill-file">{t("bill.import.file")}</Label>
							<input
								id="bill-file"
								type="file"
								accept=".xlsx,.xls"
								disabled={importing}
								className="text-sm"
								onChange={(event) => {
									const file = event.target.files?.[0]
									event.target.value = ""
									if (file) void readFile(file)
								}}
							/>
							<p className="text-xs text-muted-foreground">{importing ? t("bill.import.reading") : t("bill.import.hint")}</p>
							{imported.length > 0 ? (
								<ul className="flex flex-col divide-y rounded-xl border text-sm">
									{imported.map((row, index) => {
										const good = isBillIdValid(row.billId) && isPayIdValid(row.payId, row.billId)
										return (
											<li key={index} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
												<span dir="ltr" className="tabular-nums">
													{row.billId} / {row.payId}
												</span>
												{good ? <span className="font-medium">{`${formatAmount(amountOfPayId(row.payId), i18n.language)} ${t("bill.rial")}`}</span> : <span className="text-destructive">{row.message || t("bill.import.badRow")}</span>}
											</li>
										)
									})}
								</ul>
							) : null}
						</div>
					) : (
						<div className="flex flex-col gap-2">
							<Label htmlFor="bill-mobile">{t("bill.mobile")}</Label>
							<Input id="bill-mobile" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={11} className="h-11 text-base" value={mobile} aria-invalid={mobile !== "" && !mobileOk} aria-describedby={mobile !== "" && !mobileOk ? "bill-mobile-error" : undefined} onChange={(event) => setMobile(digits(event.target.value))} />
							{mobile !== "" && !mobileOk ? <FieldError id="bill-mobile-error">{t("bill.error.mobile")}</FieldError> : null}
							<p className="text-xs text-muted-foreground">{t("bill.mobileHint")}</p>
						</div>
					)}

					<div className="flex flex-col gap-2">
						<Label htmlFor="bill-title">
							{t("bill.titleField")} <span className="font-normal text-muted-foreground">({t("bill.optional")})</span>
						</Label>
						<Input id="bill-title" maxLength={50} value={title} onChange={(event) => setTitle(event.target.value)} />
					</div>
					<div className="flex items-center gap-2">
						<Checkbox id="bill-remember" checked={remember} onCheckedChange={(on) => setRemember(on === true)} />
						<Label htmlFor="bill-remember">{t("bill.remember")}</Label>
					</div>

					{problem ? <FieldError>{problem}</FieldError> : null}
					<div>
						<Button asChild variant="outline">
							<Link to={routeMap.billList.path}>{t("bill.cancel")}</Link>
						</Button>
					</div>
				</StepSection>
			</FlowLayout>

			{paying ? <PayBillsDialog bills={paying} remember={remember} onClose={() => setPaying(null)} /> : null}
		</form>
	)
}

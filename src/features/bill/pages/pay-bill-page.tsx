import * as React from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Checkbox} from "@/components/ui/checkbox"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {getMobileBill, type PayableBill} from "@/features/bill/api/bill"
import {PayBillsDialog} from "@/features/bill/components/pay-bills-dialog"
import {amountOfPayId, billKindOf, isBillIdValid, isPayIdValid} from "@/features/bill/lib/bill-codes"
import {formatAmount} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

type Mode = "ids" | "mobile"

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

	const billOk = isBillIdValid(billId)
	const payOk = billOk && isPayIdValid(payId, billId)
	const mobileOk = /^09\d{9}$/.test(mobile)
	const kind = billOk ? billKindOf(billId) : null
	const ready = mode === "ids" ? payOk : mobileOk

	const review = async (): Promise<void> => {
		setProblem(null)
		if (!ready) return
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

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("bill.newTitle")}</h1>

			<div className="flex gap-2" role="group" aria-label={t("bill.mode")}>
				<Button type="button" variant={mode === "ids" ? "default" : "outline"} aria-pressed={mode === "ids"} onClick={() => setMode("ids")}>
					{t("bill.byIds")}
				</Button>
				<Button type="button" variant={mode === "mobile" ? "default" : "outline"} aria-pressed={mode === "mobile"} onClick={() => setMode("mobile")}>
					{t("bill.byMobile")}
				</Button>
			</div>

			<form
				className="flex flex-col gap-4 rounded-lg border bg-card p-5"
				onSubmit={(event) => {
					event.preventDefault()
					void review()
				}}
			>
				{mode === "ids" ? (
					<>
						<div className="flex flex-col gap-2">
							<Label htmlFor="bill-id">{t("bill.billId")}</Label>
							<Input id="bill-id" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={13} value={billId} aria-invalid={billId !== "" && !billOk} onChange={(event) => setBillId(digits(event.target.value))} />
							{billId !== "" && !billOk ? <p className="text-xs text-destructive">{t("bill.error.billId")}</p> : null}
							{kind ? <p className="text-xs text-muted-foreground">{t(`bill.kind.${kind}`)}</p> : null}
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="pay-id">{t("bill.payId")}</Label>
							<Input id="pay-id" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={13} value={payId} aria-invalid={payId !== "" && !payOk} onChange={(event) => setPayId(digits(event.target.value))} />
							{payId !== "" && !payOk ? <p className="text-xs text-destructive">{t("bill.error.payId")}</p> : null}
							{payOk ? <p className="text-sm font-medium">{t("bill.amountIs", {amount: `${formatAmount(amountOfPayId(payId), i18n.language)} ${t("bill.rial")}`})}</p> : null}
						</div>
					</>
				) : (
					<div className="flex flex-col gap-2">
						<Label htmlFor="bill-mobile">{t("bill.mobile")}</Label>
						<Input id="bill-mobile" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={11} value={mobile} aria-invalid={mobile !== "" && !mobileOk} onChange={(event) => setMobile(digits(event.target.value))} />
						{mobile !== "" && !mobileOk ? <p className="text-xs text-destructive">{t("bill.error.mobile")}</p> : null}
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

				{problem ? (
					<p role="alert" className="text-sm text-destructive">
						{problem}
					</p>
				) : null}
				<div className="flex justify-end gap-2">
					<Button asChild variant="outline">
						<Link to={routeMap.billList.path}>{t("bill.cancel")}</Link>
					</Button>
					<Button type="submit" disabled={!ready || preparing}>
						{preparing ? t("bill.preparing") : t("bill.review")}
					</Button>
				</div>
			</form>

			{paying ? <PayBillsDialog bills={paying} remember={remember} onClose={() => setPaying(null)} /> : null}
		</div>
	)
}

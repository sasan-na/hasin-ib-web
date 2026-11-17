import {useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {transferPichakCheque, type PichakCheque} from "@/features/cheque/api/pichak-inquiry"
import {checkRecipients, newRecipientRow, RecipientsEditor, toRecipients, type RecipientRow} from "@/features/cheque/components/recipients-editor"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {isValidIban} from "@/features/transfer/lib/numbers"
import {formatAmount} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

interface Props {
	sayyadId: string
	cheque: PichakCheque
}

/** Passes a cheque you hold on to someone else: who gets it, an optional account for it, and a note. */
export function PichakTransferSection({sayyadId, cheque}: Props) {
	const {t, i18n} = useTranslation()
	const [rows, setRows] = useState<RecipientRow[]>(() => [newRecipientRow(1)])
	const [description, setDescription] = useState("")
	const [iban, setIban] = useState("")
	const [errors, setErrors] = useState<Partial<Record<"description" | "iban" | "recipients", string>>>({})
	const [confirming, setConfirming] = useState(false)
	const amount = Number(cheque.amount)

	const sending = useSubmitTransaction({
		run: () => transferPichakCheque({sayyadId, description: description.trim(), iban, recipients: toRecipients(rows), series: cheque.series, serial: cheque.serial, dueDate: cheque.dueDate, amount}),
		again: {to: routeMap.pichakInquiry.path, label: t("cheque.pichak.backToInquiry")},
		failedText: t("cheque.pichak.transferFailed"),
		uncertainText: t("cheque.pichak.transferUncertain"),
	})

	const review = (): void => {
		const found: typeof errors = {}
		if (description.trim() === "") found.description = t("cheque.register.error.description")
		if (iban !== "" && !isValidIban(iban)) found.iban = t("cheque.register.error.iban")
		const checked = checkRecipients(rows, {notChecked: t("cheque.register.error.notChecked"), duplicate: t("cheque.register.error.duplicate")})
		setRows(checked.rows)
		if (!checked.ok) found.recipients = t("cheque.register.error.fixRecipients")
		setErrors(found)
		if (Object.keys(found).length > 0) return
		sending.reset()
		setConfirming(true)
	}

	return (
		<section aria-label={t("cheque.pichak.transferTitle")} className="flex flex-col gap-4 rounded-lg border bg-card p-5">
			<div className="flex flex-col gap-1">
				<h2 className="text-base font-semibold">{t("cheque.pichak.transferTitle")}</h2>
				<p className="text-sm text-muted-foreground">{t("cheque.pichak.transferIntro")}</p>
			</div>

			<RecipientsEditor sayyadId={sayyadId} rows={rows} setRows={setRows} title={t("cheque.pichak.newReceivers")} />
			{errors.recipients ? (
				<p role="alert" className="text-sm text-destructive">
					{errors.recipients}
				</p>
			) : null}

			<div className="flex flex-col gap-2">
				<Label htmlFor="pt-iban">
					{t("cheque.register.iban")} <span className="font-normal text-muted-foreground">({t("cheque.register.optional")})</span>
				</Label>
				<div className="flex items-center gap-1" dir="ltr">
					<span className="text-sm text-muted-foreground">IR</span>
					<Input id="pt-iban" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={24} value={iban} aria-invalid={errors.iban !== undefined} onChange={(event) => setIban(normalizeDigits(event.target.value).replace(/\D/g, ""))} />
				</div>
				{errors.iban ? (
					<p role="alert" className="text-sm text-destructive">
						{errors.iban}
					</p>
				) : null}
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="pt-description">{t("cheque.pichak.description")}</Label>
				<Input id="pt-description" maxLength={250} value={description} aria-invalid={errors.description !== undefined} onChange={(event) => setDescription(event.target.value)} />
				{errors.description ? (
					<p role="alert" className="text-sm text-destructive">
						{errors.description}
					</p>
				) : null}
			</div>

			<div>
				<Button type="button" onClick={review}>
					{t("cheque.pichak.transferReview")}
				</Button>
			</div>

			{confirming ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setConfirming(false)
					}}
					title={t("cheque.pichak.transferConfirmTitle")}
					description={t("cheque.pichak.transferConfirmQuestion")}
					summary={[
						{label: t("cheque.sayyadId"), value: <span dir="ltr">{sayyadId}</span>},
						{label: t("cheque.serial"), value: <span dir="ltr">{`${cheque.series} / ${cheque.serial}`}</span>},
						...(Number.isFinite(amount) ? [{label: t("cheque.pichak.amount"), value: <strong>{`${formatAmount(amount, i18n.language)} ${t("cheque.rial")}`}</strong>}] : []),
						...rows.map((row, index) => ({label: t("cheque.register.recipient", {number: index + 1}), value: `${row.name} (${row.idCode})`})),
					]}
					confirmLabel={t("cheque.pichak.transferConfirm")}
					pendingLabel={t("cheque.pichak.sending")}
					canConfirm={!sending.blocked}
					pending={sending.pending}
					error={sending.refusal}
					onConfirm={sending.submit}
				/>
			) : null}
		</section>
	)
}

import {useMutation} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link, useNavigate, useSearchParams} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {determineGuarantors, requestDeterminationApproval, type DeterminationAttempt} from "@/features/cheque/api/chakad-guarantee"
import {checkRecipients, newRecipientRow, RecipientsEditor, toRecipients, type RecipientRow} from "@/features/cheque/components/recipients-editor"
import {getMyNationalCode} from "@/features/profile/api/profile"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import type {TransactionResultState} from "@/features/transaction/pages/transaction-result-page"

/** Name the guarantors of a digital cheque you issued; you approve the list in the Hamoon app. */
export default function ChakadGuarantorsPage() {
	const {t} = useTranslation()
	const navigate = useNavigate()
	const [params] = useSearchParams()
	const sayyadId = params.get("sayyad") ?? ""
	const [rows, setRows] = useState<RecipientRow[]>(() => [newRecipientRow(1)])
	const [problem, setProblem] = useState("")
	const [confirming, setConfirming] = useState(false)
	// Set once the request has been sent to the Hamoon app.
	const [attempt, setAttempt] = useState<DeterminationAttempt | null>(null)
	const [refusal, setRefusal] = useState<string | null>(null)
	// The final request may have reached the bank, so it is not offered again until a fresh review.
	const [blocked, setBlocked] = useState(false)

	const ask = useMutation({
		mutationFn: async () => requestDeterminationApproval(sayyadId, toRecipients(rows), await getMyNationalCode()),
		onSuccess: (started) => {
			setRefusal(null)
			setAttempt(started)
		},
		onError: (error: Error) => setRefusal(error.message || t("cheque.issue.signFailed")),
	})

	const send = useMutation({
		mutationFn: () => {
			if (!attempt) throw new Error("not approved")
			return determineGuarantors(sayyadId, toRecipients(rows), attempt)
		},
		onSuccess: (outcome) => {
			if (outcome.state === "waiting") return setRefusal(t("cheque.guarantors.waiting"))
			const {result} = outcome
			if (!result.ok && result.transactionId === null) return setRefusal(result.message || t("cheque.guarantors.failed"))
			const state: TransactionResultState = {result, again: {to: routeMap.chequeList.path, label: t("cheque.block.backToList")}}
			void navigate(routeMap.transactionResult.path, {state, replace: true})
		},
		onError: () => {
			setRefusal(t("cheque.guarantors.uncertain"))
			setBlocked(true)
		},
	})

	const review = (): void => {
		const checked = checkRecipients(rows, {notChecked: t("cheque.register.error.notChecked"), duplicate: t("cheque.register.error.duplicate")})
		setRows(checked.rows)
		if (!checked.ok) return setProblem(t("cheque.register.error.fixRecipients"))
		setProblem("")
		setAttempt(null)
		setRefusal(null)
		setBlocked(false)
		setConfirming(true)
	}

	if (sayyadId.length !== 16) {
		return (
			<div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
				<h1 className="text-2xl font-bold">{t("cheque.guarantors.title")}</h1>
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{t("cheque.register.noCheque")}
				</p>
				<Button asChild variant="outline" className="self-start">
					<Link to={routeMap.chequeList.path}>{t("cheque.title")}</Link>
				</Button>
			</div>
		)
	}

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("cheque.guarantors.title")}</h1>
			<p className="text-sm text-muted-foreground">{t("cheque.guarantors.hint")}</p>
			<p className="text-sm">
				{t("cheque.sayyadId")}: <span dir="ltr">{sayyadId}</span>
			</p>

			<form
				className="flex flex-col gap-5 rounded-lg border bg-card p-5"
				onSubmit={(event) => {
					event.preventDefault()
					review()
				}}
			>
				<RecipientsEditor sayyadId={sayyadId} rows={rows} setRows={setRows} title={t("cheque.issue.guarantors")} />
				{problem ? (
					<p role="alert" className="text-sm text-destructive">
						{problem}
					</p>
				) : null}
				<div className="flex justify-end gap-2">
					<Button asChild variant="outline">
						<Link to={routeMap.chequeList.path}>{t("cheque.register.cancel")}</Link>
					</Button>
					<Button type="submit">{t("cheque.register.review")}</Button>
				</div>
			</form>

			{confirming ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (open) return
						setAttempt(null)
						setConfirming(false)
					}}
					title={t("cheque.guarantors.confirmTitle")}
					description={attempt ? t("cheque.issue.approveQuestion") : t("cheque.guarantors.confirmQuestion")}
					summary={[
						{label: t("cheque.sayyadId"), value: <span dir="ltr">{sayyadId}</span>},
						...rows.map((row, index) => ({label: t("cheque.issue.guarantor", {number: index + 1}), value: `${row.name} (${row.idCode})`})),
					]}
					confirmLabel={attempt ? t("cheque.guarantors.send") : t("cheque.issue.sign")}
					pendingLabel={t("cheque.guarantee.sending")}
					canConfirm={!blocked}
					pending={ask.isPending || send.isPending}
					error={refusal}
					onConfirm={() => {
						setRefusal(null)
						if (attempt) send.mutate()
						else ask.mutate()
					}}
				>
					{attempt ? (
						<p role="status" className="rounded-md border bg-muted p-3 text-sm">
							{t("cheque.issue.hamoonSent")}
						</p>
					) : null}
				</ConfirmDialog>
			) : null}
		</div>
	)
}

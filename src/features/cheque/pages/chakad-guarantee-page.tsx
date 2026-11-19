import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useSearchParams } from "react-router-dom"

import { routeMap } from "@/app/routes"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
	FlowLayout,
	FlowSummary,
	StepSection,
} from "@/components/flow/flow-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	getGuaranteeView,
	getGuarantorView,
	requestForGuarantee,
	requestGuaranteeApproval,
	signGuarantee,
	stopGuarantorSigning,
	type GuaranteeCheque,
	type GuaranteeView,
	type GuarantorView,
} from "@/features/cheque/api/chakad-guarantee"
import { getMyNationalCode } from "@/features/profile/api/profile"
import { ConfirmDialog } from "@/features/transaction/components/confirm-dialog"
import { useSubmitTransaction } from "@/features/transaction/hooks/use-submit-transaction"
import { formatAmount } from "@/lib/format"
import { normalizeDigits } from "@/lib/normalize-digits"

type Mode = "sign" | "inquiry" | "request" | "stop"
const MODES: Mode[] = ["sign", "inquiry", "request", "stop"]
const SAYYAD_LENGTH = 16

/** "14050101" as "1405/01/01"; anything else as it came. */
const dueText = (value: string): string =>
	/^\d{8}$/.test(value)
		? `${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6)}`
		: value

/** Everything about guarantees on digital cheques: sign as a guarantor, see where a guarantee stands, ask for it or stop it. */
export default function ChakadGuaranteePage() {
	const { t, i18n } = useTranslation()
	const language = i18n.language
	// The cheque list and the cartable open this page with a cheque and what to do already chosen.
	const [params] = useSearchParams()
	const wanted = params.get("mode")
	const [mode, setMode] = useState<Mode>(
		MODES.find((item) => item === wanted) ?? "sign",
	)
	const [sayyadId, setSayyadId] = useState(
		(params.get("sayyad") ?? "").replace(/\D/g, "").slice(0, SAYYAD_LENGTH),
	)
	const [problem, setProblem] = useState("")
	const [guarantor, setGuarantor] = useState<GuarantorView | null>(null)
	const [guarantee, setGuarantee] = useState<GuaranteeView | null>(null)
	const [action, setAction] = useState<
		"accept" | "refuse" | "request" | "stop" | null
	>(null)
	// The id of the approval the guarantor was asked for in the Hamoon app; set once the request has been sent.
	const [approval, setApproval] = useState<string | null>(null)
	const [signProblem, setSignProblem] = useState<string | null>(null)

	const money = (value: number): string =>
		`${formatAmount(value, language)} ${t("cheque.rial")}`

	const reset = (next: Mode): void => {
		setMode(next)
		setProblem("")
		setGuarantor(null)
		setGuarantee(null)
		setAction(null)
		setApproval(null)
	}

	const lookUp = useMutation({
		mutationFn: async () => {
			if (mode === "sign")
				return { guarantor: await getGuarantorView(sayyadId), guarantee: null }
			return { guarantor: null, guarantee: await getGuaranteeView(sayyadId) }
		},
		onSuccess: (found) => {
			setProblem("")
			setGuarantor(found.guarantor)
			setGuarantee(found.guarantee)
		},
		onError: (error: Error) => {
			setGuarantor(null)
			setGuarantee(null)
			setProblem(error.message || t("cheque.guarantee.lookupFailed"))
		},
	})

	const ask = useMutation({
		mutationFn: async () =>
			requestGuaranteeApproval(sayyadId, await getMyNationalCode()),
		onSuccess: (id) => {
			setSignProblem(null)
			setApproval(id)
		},
		onError: (error: Error) =>
			setSignProblem(error.message || t("cheque.issue.signFailed")),
	})

	const sending = useSubmitTransaction({
		run: () => {
			if (action === "accept") {
				if (!approval) throw new Error("not approved")
				return signGuarantee(sayyadId, true, approval)
			}
			if (action === "refuse") return signGuarantee(sayyadId, false, null)
			if (action === "request") return requestForGuarantee(sayyadId)
			return stopGuarantorSigning(sayyadId)
		},
		again: {
			to: routeMap.chakadGuarantee.path,
			label: t("cheque.guarantee.again"),
		},
		failedText: t("cheque.guarantee.failed"),
		uncertainText: t("cheque.guarantee.uncertain"),
	})

	const start = (next: "accept" | "refuse" | "request" | "stop"): void => {
		setApproval(null)
		setSignProblem(null)
		sending.reset()
		setAction(next)
	}

	const close = (): void => {
		setAction(null)
		setApproval(null)
		setSignProblem(null)
	}

	const details = (cheque: GuaranteeCheque) => (
		<dl className="bg-card shadow-card grid gap-2 rounded-2xl border p-5 text-sm sm:grid-cols-2">
			{(
				[
					[t("cheque.sayyadId"), cheque.sayyadId, true],
					[t("cheque.serial"), `${cheque.series} / ${cheque.serial}`, true],
					[t("cheque.register.dueDate"), dueText(cheque.dueDate), true],
					[t("cheque.pichak.amount"), money(cheque.amount), false],
					[t("cheque.guarantee.status"), cheque.status, false],
					[t("cheque.guarantee.guaranteeStatus"), cheque.guarantee, false],
					[t("cheque.guarantee.blocked"), cheque.blocked, false],
					[t("cheque.guarantee.locked"), cheque.locked, false],
					[t("cheque.pichak.description"), cheque.description, false],
				] as [string, string, boolean][]
			)
				.filter(([, value]) => value !== "")
				.map(([label, value, ltr]) => (
					<div key={label} className="flex flex-col">
						<dt className="text-muted-foreground">{label}</dt>
						<dd
							dir={ltr ? "ltr" : undefined}
							className="font-medium wrap-break-word"
						>
							{value}
						</dd>
					</div>
				))}
		</dl>
	)

	const needsLookUp = mode === "sign" || mode === "inquiry"
	const ready = sayyadId.length === SAYYAD_LENGTH
	const accepting = action === "accept"

	const submitForm = (): void => {
		if (!ready)
			return setProblem(
				t("cheque.guarantee.error.sayyad", { length: SAYYAD_LENGTH }),
			)
		setProblem("")
		setGuarantor(null)
		setGuarantee(null)
		if (needsLookUp) lookUp.mutate()
		else start(mode === "request" ? "request" : "stop")
	}
	const submitLabel = needsLookUp
		? lookUp.isPending
			? t("cheque.guarantee.looking")
			: t("cheque.guarantee.lookUp")
		: t("cheque.guarantee.review")

	return (
		<div>
			<FlowLayout
				title={t("cheque.guarantee.title")}
				aside={
					<FlowSummary
						id="cg-summary"
						title={t("cheque.guarantee.summary")}
						amount={null}
						rows={[
							{
								label: t("cheque.guarantee.actionStep"),
								value: t(`cheque.guarantee.modes.${mode}`),
							},
							{ label: t("cheque.sayyadId"), value: ready ? sayyadId : null },
						]}
						reviewLabel={submitLabel}
						onReview={() => {
							if (!lookUp.isPending) submitForm()
						}}
					/>
				}
			>
				<p className="text-muted-foreground text-sm">
					{t("cheque.guarantee.hint")}
				</p>

				<StepSection
					id="cg-action"
					step={1}
					title={t("cheque.guarantee.actionStep")}
				>
					<div
						className="flex flex-wrap gap-2"
						role="tablist"
						aria-label={t("cheque.guarantee.title")}
					>
						{MODES.map((item) => (
							<Button
								key={item}
								type="button"
								role="tab"
								aria-selected={mode === item}
								variant={mode === item ? "default" : "outline"}
								onClick={() => reset(item)}
							>
								{t(`cheque.guarantee.modes.${item}`)}
							</Button>
						))}
					</div>
					<p className="text-muted-foreground text-sm">
						{t(`cheque.guarantee.modeHint.${mode}`)}
					</p>
				</StepSection>

				<StepSection
					id="cg-cheque"
					step={2}
					title={t("cheque.guarantee.chequeStep")}
				>
					<form
						className="flex flex-col gap-4"
						onSubmit={(event) => {
							event.preventDefault()
							submitForm()
						}}
					>
						<div className="flex flex-col gap-2">
							<Label htmlFor="cg-sayyad">{t("cheque.sayyadId")}</Label>
							<Input
								id="cg-sayyad"
								dir="ltr"
								inputMode="numeric"
								autoComplete="off"
								maxLength={SAYYAD_LENGTH}
								className="h-11 max-w-72 text-base"
								value={sayyadId}
								onChange={(event) =>
									setSayyadId(
										normalizeDigits(event.target.value).replace(/\D/g, ""),
									)
								}
							/>
						</div>
						{problem ? (
							<Alert variant="destructive">
								<AlertDescription>{problem}</AlertDescription>
							</Alert>
						) : null}
						<div>
							<Button
								type="submit"
								variant="outline"
								disabled={lookUp.isPending}
							>
								{submitLabel}
							</Button>
						</div>
					</form>

					{guarantor ? (
						<section className="flex flex-col gap-4">
							{details(guarantor.cheque)}
							{guarantor.myAnswer ? (
								<p className="text-sm">
									{t("cheque.guarantee.myAnswer", {
										answer: guarantor.myAnswer,
									})}
								</p>
							) : null}
							{guarantor.receivers.length > 0 ? (
								<p className="text-sm">
									{t("cheque.pichak.receivers")}:{" "}
									{guarantor.receivers
										.map((item) => `${item.name} (${item.idCode})`)
										.join("، ")}
								</p>
							) : null}
							<div className="flex flex-wrap gap-2">
								<Button type="button" onClick={() => start("accept")}>
									{t("cheque.guarantee.accept")}
								</Button>
								<Button
									type="button"
									variant="destructive"
									onClick={() => start("refuse")}
								>
									{t("cheque.guarantee.refuse")}
								</Button>
							</div>
						</section>
					) : null}

					{guarantee ? (
						<section className="flex flex-col gap-4">
							{details(guarantee.cheque)}
							{guarantee.guarantors.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									{t("cheque.guarantee.noGuarantors")}
								</p>
							) : (
								<ul className="flex flex-col gap-2">
									{guarantee.guarantors.map((item) => (
										<li
											key={item.idCode}
											className="bg-card flex flex-wrap items-baseline justify-between gap-2 rounded-md border p-3 text-sm"
										>
											<span>
												{item.name} <span dir="ltr">({item.idCode})</span>
											</span>
											<span className="text-muted-foreground">
												{item.status}
												{item.date ? ` · ${dueText(item.date)}` : ""}
											</span>
										</li>
									))}
								</ul>
							)}
						</section>
					) : null}

					<div>
						<Button asChild variant="outline">
							<Link to={routeMap.chequeList.path}>{t("cheque.title")}</Link>
						</Button>
					</div>
				</StepSection>
			</FlowLayout>

			{action ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) close()
					}}
					title={t(`cheque.guarantee.confirm.${action}.title`)}
					description={
						accepting && approval
							? t("cheque.issue.approveQuestion")
							: t(`cheque.guarantee.confirm.${action}.question`)
					}
					summary={[
						{
							label: t("cheque.sayyadId"),
							value: <span dir="ltr">{sayyadId}</span>,
						},
					]}
					confirmLabel={
						accepting
							? approval
								? t("cheque.guarantee.sign")
								: t("cheque.issue.sign")
							: t(`cheque.guarantee.confirm.${action}.button`)
					}
					pendingLabel={t("cheque.guarantee.sending")}
					destructive={action === "refuse" || action === "stop"}
					canConfirm={!sending.blocked}
					pending={ask.isPending || sending.pending}
					error={sending.refusal ?? signProblem}
					onConfirm={() => {
						if (accepting && !approval) {
							setSignProblem(null)
							ask.mutate()
						} else sending.submit()
					}}
				>
					{accepting && approval ? (
						<p role="status" className="bg-muted rounded-md border p-3 text-sm">
							{t("cheque.issue.hamoonSent")}
						</p>
					) : null}
				</ConfirmDialog>
			) : null}
		</div>
	)
}

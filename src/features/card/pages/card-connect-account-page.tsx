import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, Navigate, useSearchParams } from "react-router-dom"

import { routeMap } from "@/app/routes"
import {
	FieldError,
	FlowLayout,
	FlowSummary,
	StepSection,
} from "@/components/flow/flow-form"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { connectAccounts } from "@/features/card/api/card-account"
import {
	addableAccountsOptions,
	cardAccountsOptions,
	cardCredentialInfoOptions,
	cardKeys,
} from "@/features/card/api/card.queries"
import {
	CardCredentialsFields,
	EMPTY_CREDENTIALS,
	isCredentialsComplete,
	toCredentials,
	type CredentialsForm,
} from "@/features/card/components/card-credentials"
import { ConfirmDialog } from "@/features/transaction/components/confirm-dialog"
import { useSubmitTransaction } from "@/features/transaction/hooks/use-submit-transaction"
import { formatCardNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** The bank's service name for the SMS code on these card requests. */
const CODE_SERVICE = "CardAuthorize"

/** Link more of your accounts to a card. */
export default function CardConnectAccountPage() {
	const { t, i18n } = useTranslation()
	const queryClient = useQueryClient()
	const [params] = useSearchParams()
	const cardId = Number(params.get("cardId"))
	const valid = Number.isInteger(cardId) && cardId > 0

	const linked = useQuery({ ...cardAccountsOptions(cardId), enabled: valid })
	const linkedNumbers = (linked.data?.accounts ?? []).map(
		(account) => account.number,
	)
	const addable = useQuery({
		...addableAccountsOptions(cardId, linkedNumbers),
		enabled: valid && linked.isSuccess,
	})
	const addableNumbers = addable.data ?? []

	const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set())
	const [confirming, setConfirming] = useState(false)
	const [form, setForm] = useState<CredentialsForm>(EMPTY_CREDENTIALS)
	const info = useQuery({
		...cardCredentialInfoOptions(cardId, i18n.language),
		enabled: valid && confirming,
	})
	const cardNumber = linked.data?.cardNumber ?? ""
	const credentials = toCredentials(cardNumber, form, info.data)

	const sending = useSubmitTransaction({
		run: () => {
			if (!credentials || chosen.size === 0) throw new Error("form incomplete")
			return connectAccounts({ accountNumbers: [...chosen], credentials })
		},
		// A request that went through changes which accounts are linked.
		onDone: () =>
			queryClient.invalidateQueries({ queryKey: cardKeys.accounts(cardId) }),
		again: {
			to: `${routeMap.cardAccountList.path}?cardId=${cardId}`,
			label: t("card.accounts.backToAccounts"),
		},
		failedText: t("card.accounts.failed"),
		uncertainText: t("card.accounts.uncertain"),
	})

	if (!valid) return <Navigate to={routeMap.cardList.path} replace />
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft

	const toggle = (number: string, checked: boolean): void =>
		setChosen((current) => {
			const next = new Set(current)
			if (checked) next.add(number)
			else next.delete(number)
			return next
		})

	const review = (): void => {
		setForm(EMPTY_CREDENTIALS)
		sending.reset()
		setConfirming(true)
	}

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-bold">
						{t("card.accounts.connectTitle")}
					</h1>
					{cardNumber ? (
						<p
							dir="ltr"
							className="text-muted-foreground text-start text-sm tabular-nums"
						>
							{formatCardNumber(cardNumber)}
						</p>
					) : null}
				</div>
				<Button asChild variant="outline" size="sm">
					<Link to={`${routeMap.cardAccountList.path}?cardId=${cardId}`}>
						<BackIcon aria-hidden="true" />
						{t("card.accounts.back")}
					</Link>
				</Button>
			</div>

			<FlowLayout
				aside={
					<FlowSummary
						id="ca-summary"
						title={t("card.accounts.summary")}
						amount={null}
						rows={[
							{
								label: t("card.number"),
								value: cardNumber ? formatCardNumber(cardNumber) : null,
							},
							{
								label: t("card.accounts.accountsToAdd"),
								value: chosen.size > 0 ? [...chosen].join(", ") : null,
							},
						]}
						reviewLabel={t("card.accounts.connectSelected")}
						onReview={() => {
							if (chosen.size > 0) review()
						}}
					/>
				}
			>
				<StepSection
					id="addable-title"
					step={1}
					title={t("card.accounts.addable")}
				>
					{linked.isPending || (linked.isSuccess && addable.isPending) ? (
						<div className="flex flex-col gap-3" aria-hidden="true">
							<Skeleton className="h-11 w-full" />
							<Skeleton className="h-11 w-full" />
						</div>
					) : linked.isError || addable.isError ? (
						<FieldError>{t("card.accounts.addableError")}</FieldError>
					) : addableNumbers.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							{t("card.accounts.noneToAdd")}
						</p>
					) : (
						<ul className="grid gap-3 sm:grid-cols-2">
							{addableNumbers.map((number) => (
								<li key={number}>
									<Label
										htmlFor={`addable-${number}`}
										className={cn(
											"bg-card flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors",
											chosen.has(number)
												? "border-primary bg-primary-soft ring-primary/20 ring-2"
												: "hover:border-foreground/40",
										)}
									>
										<Checkbox
											id={`addable-${number}`}
											checked={chosen.has(number)}
											onCheckedChange={(checked) =>
												toggle(number, checked === true)
											}
										/>
										<span dir="ltr" className="tabular-nums">
											{number}
										</span>
									</Label>
								</li>
							))}
						</ul>
					)}
				</StepSection>
			</FlowLayout>

			{confirming ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (open) return
						// What was typed for the card does not outlive the dialog.
						setForm(EMPTY_CREDENTIALS)
						setConfirming(false)
					}}
					title={t("card.accounts.connectConfirmTitle")}
					description={t("card.accounts.connectQuestion")}
					summary={[
						{
							label: t("card.number"),
							value: <span dir="ltr">{formatCardNumber(cardNumber)}</span>,
						},
						{
							label: t("card.accounts.accountsToAdd"),
							value: <span dir="ltr">{[...chosen].join(", ")}</span>,
						},
					]}
					confirmLabel={t("card.accounts.connect")}
					pendingLabel={t("card.accounts.sending")}
					canConfirm={
						isCredentialsComplete(form, info.data) && !sending.blocked
					}
					pending={sending.pending}
					error={sending.refusal}
					onConfirm={sending.submit}
				>
					<CardCredentialsFields
						cardId={cardId}
						cardNumber={cardNumber}
						codeServiceName={CODE_SERVICE}
						value={form}
						onChange={setForm}
						disabled={sending.pending}
					/>
				</ConfirmDialog>
			) : null}
		</div>
	)
}

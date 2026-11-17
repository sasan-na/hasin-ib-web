import {useQuery, useQueryClient} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link, Navigate, useSearchParams} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Checkbox} from "@/components/ui/checkbox"
import {Label} from "@/components/ui/label"
import {Skeleton} from "@/components/ui/skeleton"
import {connectAccounts} from "@/features/card/api/card-account"
import {addableAccountsOptions, cardAccountsOptions, cardCredentialInfoOptions, cardKeys} from "@/features/card/api/card.queries"
import {CardCredentialsFields, EMPTY_CREDENTIALS, isCredentialsComplete, toCredentials, type CredentialsForm} from "@/features/card/components/card-credentials"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {formatCardNumber} from "@/lib/format"

/** The bank's service name for the SMS code on these card requests. */
const CODE_SERVICE = "CardAuthorize"

/** Link more of your accounts to a card. */
export default function CardConnectAccountPage() {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const [params] = useSearchParams()
	const cardId = Number(params.get("cardId"))
	const valid = Number.isInteger(cardId) && cardId > 0

	const linked = useQuery({...cardAccountsOptions(cardId), enabled: valid})
	const linkedNumbers = (linked.data?.accounts ?? []).map((account) => account.number)
	const addable = useQuery({...addableAccountsOptions(cardId, linkedNumbers), enabled: valid && linked.isSuccess})
	const addableNumbers = addable.data ?? []

	const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set())
	const [confirming, setConfirming] = useState(false)
	const [form, setForm] = useState<CredentialsForm>(EMPTY_CREDENTIALS)
	const info = useQuery({...cardCredentialInfoOptions(cardId, i18n.language), enabled: valid && confirming})
	const cardNumber = linked.data?.cardNumber ?? ""
	const credentials = toCredentials(cardNumber, form, info.data)

	const sending = useSubmitTransaction({
		run: () => {
			if (!credentials || chosen.size === 0) throw new Error("form incomplete")
			return connectAccounts({accountNumbers: [...chosen], credentials})
		},
		// A request that went through changes which accounts are linked.
		onDone: () => queryClient.invalidateQueries({queryKey: cardKeys.accounts(cardId)}),
		again: {to: `${routeMap.cardAccountList.path}?cardId=${cardId}`, label: t("card.accounts.backToAccounts")},
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
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-bold">{t("card.accounts.connectTitle")}</h1>
					{cardNumber ? (
						<p dir="ltr" className="text-start text-sm text-muted-foreground tabular-nums">
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

			<section aria-labelledby="addable-title" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
				<h2 id="addable-title" className="text-base font-semibold">
					{t("card.accounts.addable")}
				</h2>
				{linked.isPending || (linked.isSuccess && addable.isPending) ? (
					<div className="flex flex-col gap-3" aria-hidden="true">
						<Skeleton className="h-8 w-full" />
						<Skeleton className="h-8 w-full" />
					</div>
				) : linked.isError || addable.isError ? (
					<p role="alert" className="text-sm text-destructive">
						{t("card.accounts.addableError")}
					</p>
				) : addableNumbers.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t("card.accounts.noneToAdd")}</p>
				) : (
					<ul className="flex flex-col gap-3">
						{addableNumbers.map((number) => (
							<li key={number} className="flex items-center gap-3">
								<Checkbox id={`addable-${number}`} checked={chosen.has(number)} onCheckedChange={(checked) => toggle(number, checked === true)} />
								<Label htmlFor={`addable-${number}`} dir="ltr" className="tabular-nums">
									{number}
								</Label>
							</li>
						))}
					</ul>
				)}
			</section>

			<div>
				<Button type="button" disabled={chosen.size === 0} onClick={review}>
					{t("card.accounts.connectSelected")}
				</Button>
			</div>

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
						{label: t("card.number"), value: <span dir="ltr">{formatCardNumber(cardNumber)}</span>},
						{label: t("card.accounts.accountsToAdd"), value: <span dir="ltr">{[...chosen].join(", ")}</span>},
					]}
					confirmLabel={t("card.accounts.connect")}
					pendingLabel={t("card.accounts.sending")}
					canConfirm={isCredentialsComplete(form, info.data) && !sending.blocked}
					pending={sending.pending}
					error={sending.refusal}
					onConfirm={sending.submit}
				>
					<CardCredentialsFields cardId={cardId} cardNumber={cardNumber} codeServiceName={CODE_SERVICE} value={form} onChange={setForm} disabled={sending.pending} />
				</ConfirmDialog>
			) : null}
		</div>
	)
}

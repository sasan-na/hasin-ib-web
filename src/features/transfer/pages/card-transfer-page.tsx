import {useMutation, useQuery} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {cardsOptions} from "@/features/card/api/card.queries"
import {getCardHolder} from "@/features/transfer/api/card-transfer"
import {reasonCodesOptions} from "@/features/transfer/api/transfer.queries"
import {CardTransferDialog} from "@/features/transfer/components/card-transfer-dialog"
import {isValidCardNumber} from "@/features/transfer/lib/numbers"
import {formatAmount, formatCardNumber} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

type Errors = Partial<Record<"source" | "destination" | "amount" | "reason", string>>

const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")

/** Send money from one of your cards to any bank card by its number. */
export default function CardTransferPage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const cards = useQuery(cardsOptions(language))
	const reasons = useQuery(reasonCodesOptions(language))

	const [sourceId, setSourceId] = useState("")
	const [destination, setDestination] = useState("")
	const [amount, setAmount] = useState("")
	const [reasonCode, setReasonCode] = useState("")
	const [description, setDescription] = useState("")
	const [errors, setErrors] = useState<Errors>({})
	const [confirming, setConfirming] = useState(false)

	const source = cards.data?.find((card) => String(card.id) === sourceId)
	const lookup = useMutation({mutationFn: () => getCardHolder(source?.number ?? "", destination)})
	const holder = lookup.data
	const amountValue = amount === "" ? 0 : Number(amount)
	const reason = reasons.data?.find((candidate) => candidate.code === reasonCode)
	const money = (value: number): string => `${formatAmount(value, language)} ${t("transfer.rial")}`

	const touch = (): void => setErrors({})

	const destinationProblem = (): string | null => {
		if (!isValidCardNumber(destination)) return t("transfer.card.error.format")
		if (source && source.number === destination) return t("transfer.card.error.same")
		return null
	}

	const check = (): void => {
		const found: Errors = {}
		if (!source) found.source = t("transfer.card.error.source")
		const problem = destinationProblem()
		if (problem) found.destination = problem
		setErrors(found)
		if (Object.keys(found).length === 0) lookup.mutate()
	}

	const review = (): void => {
		const found: Errors = {}
		if (!source) found.source = t("transfer.card.error.source")
		if (!holder) found.destination = destinationProblem() ?? t("transfer.card.error.notChecked")
		if (amountValue <= 0) found.amount = t("transfer.error.amount")
		if ((reasons.data?.length ?? 0) > 0 && !reason) found.reason = t("transfer.error.reason")
		setErrors(found)
		if (Object.keys(found).length > 0) return
		setConfirming(true)
	}

	const error = (message?: string) =>
		message ? (
			<p role="alert" className="text-sm text-destructive">
				{message}
			</p>
		) : null

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("transfer.card.title")}</h1>

			<section aria-labelledby="ct-from" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
				<h2 id="ct-from" className="text-base font-semibold">
					{t("transfer.from")}
				</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="ct-source">{t("transfer.card.sourceCard")}</Label>
					{cards.isPending ? (
						<Skeleton className="h-9 w-full" />
					) : cards.isError ? (
						error(t("transfer.card.cardsError"))
					) : cards.data.length === 0 ? (
						<p className="text-sm text-muted-foreground">{t("transfer.card.noCards")}</p>
					) : (
						<Select
							value={sourceId}
							onValueChange={(value) => {
								setSourceId(value)
								// The lookup was made for another paying card.
								lookup.reset()
								touch()
							}}
						>
							<SelectTrigger id="ct-source" className="w-full" aria-invalid={errors.source !== undefined}>
								<SelectValue placeholder={t("transfer.card.chooseCard")} />
							</SelectTrigger>
							<SelectContent>
								{cards.data.map((card) => (
									<SelectItem key={card.id} value={String(card.id)}>
										<span>{card.name || card.type}</span> <span dir="ltr">{formatCardNumber(card.number)}</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
					{error(errors.source)}
				</div>
			</section>

			<section aria-labelledby="ct-to" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
				<h2 id="ct-to" className="text-base font-semibold">
					{t("transfer.to")}
				</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="ct-destination">{t("transfer.card.destinationCard")}</Label>
					<div className="flex items-center gap-2">
						<Input
							id="ct-destination"
							dir="ltr"
							inputMode="numeric"
							autoComplete="off"
							maxLength={16}
							value={destination}
							aria-invalid={errors.destination !== undefined}
							onChange={(event) => {
								setDestination(digits(event.target.value))
								lookup.reset()
								touch()
							}}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault()
									check()
								}
							}}
						/>
						<Button type="button" variant="outline" disabled={lookup.isPending || destination === ""} onClick={check}>
							{lookup.isPending ? t("transfer.checking") : t("transfer.check")}
						</Button>
					</div>
					{holder ? (
						<p role="status" className="text-sm font-medium text-success">
							{t("transfer.holder", {name: holder.name})}
						</p>
					) : null}
					{lookup.isError ? error(lookup.error.message || t("transfer.lookupFailed")) : null}
					{error(errors.destination)}
				</div>
			</section>

			<section aria-labelledby="ct-details" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
				<h2 id="ct-details" className="text-base font-semibold">
					{t("transfer.details")}
				</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="ct-amount">{t("transfer.amount")}</Label>
					<Input
						id="ct-amount"
						dir="ltr"
						inputMode="numeric"
						autoComplete="off"
						maxLength={15}
						className="max-w-72"
						value={amount}
						aria-invalid={errors.amount !== undefined}
						onChange={(event) => {
							setAmount(digits(event.target.value).replace(/^0+/, ""))
							touch()
						}}
					/>
					{amount !== "" ? <p className="text-sm text-muted-foreground">{money(amountValue)}</p> : null}
					{error(errors.amount)}
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="ct-reason">{t("transfer.reason")}</Label>
					{reasons.isPending ? (
						<Skeleton className="h-9 w-full" />
					) : reasons.isError ? (
						error(t("transfer.reasonsError"))
					) : (
						<Select
							value={reasonCode}
							onValueChange={(value) => {
								setReasonCode(value)
								touch()
							}}
						>
							<SelectTrigger id="ct-reason" className="w-full" aria-invalid={errors.reason !== undefined}>
								<SelectValue placeholder={t("transfer.chooseReason")} />
							</SelectTrigger>
							<SelectContent>
								{reasons.data.map((candidate) => (
									<SelectItem key={candidate.code} value={candidate.code}>
										{candidate.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
					{error(errors.reason)}
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="ct-description">
						{t("transfer.description")} <span className="font-normal text-muted-foreground">({t("transfer.optional")})</span>
					</Label>
					<Input id="ct-description" value={description} onChange={(event) => setDescription(event.target.value)} />
				</div>
			</section>

			<div>
				<Button type="button" onClick={review}>
					{t("transfer.review")}
				</Button>
			</div>

			{confirming && source && holder ? (
				<CardTransferDialog
					cardId={source.id}
					cardNumber={source.number}
					holder={holder}
					amount={amountValue}
					description={description.trim()}
					reason={reason}
					onClose={() => {
						setConfirming(false)
						// The lookup is single-use: whatever happened, the next attempt starts with a fresh one.
						lookup.reset()
					}}
				/>
			) : null}
		</div>
	)
}

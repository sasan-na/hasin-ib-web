import {useQuery} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Checkbox} from "@/components/ui/checkbox"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {cardlessConfigOptions, cardsOptions} from "@/features/card/api/card.queries"
import {IssueCardlessDialog} from "@/features/card/components/cardless-dialogs"
import {formatAmount, formatCardNumber} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

type Errors = Partial<Record<"card" | "mobile" | "amount" | "password", string>>

const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")

/** Issue a one-time withdrawal ticket: the receiver takes cash from an ATM with their mobile number and a password you choose. */
export default function CardlessNewPage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const cards = useQuery(cardsOptions(language))
	const config = useQuery(cardlessConfigOptions())

	const [cardId, setCardId] = useState("")
	const [mobile, setMobile] = useState("")
	const [amount, setAmount] = useState("")
	const [password, setPassword] = useState("")
	const [remember, setRemember] = useState(false)
	const [errors, setErrors] = useState<Errors>({})
	const [confirming, setConfirming] = useState(false)

	const card = cards.data?.find((candidate) => String(candidate.id) === cardId)
	const limits = config.data
	const amountValue = amount === "" ? 0 : Number(amount)
	const money = (value: number): string => `${formatAmount(value, language)} ${t("card.rial")}`

	const review = (): void => {
		if (!limits) return
		const found: Errors = {}
		if (!card) found.card = t("card.cardless.error.card")
		if (!/^09\d{9}$/.test(mobile)) found.mobile = t("card.cardless.error.mobile")
		if (amountValue < limits.minAmount || amountValue > limits.maxAmount) {
			found.amount = t("card.cardless.error.between", {min: formatAmount(limits.minAmount, language), max: formatAmount(limits.maxAmount, language)})
		} else if (amountValue % limits.ratio !== 0) {
			found.amount = t("card.cardless.error.ratio", {value: formatAmount(limits.ratio, language)})
		}
		if (password.length < limits.minPasswordLength || password.length > limits.maxPasswordLength) {
			found.password = t("card.cardless.error.password", {min: formatAmount(limits.minPasswordLength, language), max: formatAmount(limits.maxPasswordLength, language)})
		}
		setErrors(found)
		if (Object.keys(found).length === 0) setConfirming(true)
	}

	const error = (message?: string) =>
		message ? (
			<p role="alert" className="text-sm text-destructive">
				{message}
			</p>
		) : null

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("card.cardless.newTitle")}</h1>
			<p className="text-sm text-muted-foreground">{t("card.cardless.intro")}</p>

			{config.isError ? (
				<p role="alert" className="rounded-lg bg-card p-5 text-sm text-destructive">
					{t("card.cardless.configError")}
				</p>
			) : (
				<form
					className="flex flex-col gap-4 rounded-lg border bg-card p-5"
					onSubmit={(event) => {
						event.preventDefault()
						review()
					}}
				>
					<div className="flex flex-col gap-2">
						<Label htmlFor="cl-card">{t("card.cardless.card")}</Label>
						{cards.isPending ? (
							<Skeleton className="h-9 w-full" />
						) : cards.isError ? (
							<p role="alert" className="text-sm text-destructive">
								{t("card.cardless.cardsError")}
							</p>
						) : (
							<Select value={cardId} onValueChange={setCardId}>
								<SelectTrigger id="cl-card" className="w-full" aria-invalid={errors.card !== undefined}>
									<SelectValue placeholder={t("card.cardless.chooseCard")} />
								</SelectTrigger>
								<SelectContent>
									{cards.data.map((candidate) => (
										<SelectItem key={candidate.id} value={String(candidate.id)}>
											{candidate.name ? `${candidate.name} · ` : ""}
											{formatCardNumber(candidate.number)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
						{error(errors.card)}
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="cl-mobile">{t("card.cardless.mobile")}</Label>
						<Input id="cl-mobile" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={11} value={mobile} aria-invalid={errors.mobile !== undefined} onChange={(event) => setMobile(digits(event.target.value))} />
						{error(errors.mobile)}
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="cl-amount">{t("card.cardless.amount")}</Label>
						<Input id="cl-amount" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={13} value={amount} aria-invalid={errors.amount !== undefined} onChange={(event) => setAmount(digits(event.target.value).replace(/^0+/, ""))} />
						{amount !== "" ? <p className="text-sm text-muted-foreground">{money(amountValue)}</p> : null}
						{limits ? (
							<p className="text-xs text-muted-foreground">
								{t("card.cardless.limits", {min: formatAmount(limits.minAmount, language), max: formatAmount(limits.maxAmount, language), ratio: formatAmount(limits.ratio, language)})}
							</p>
						) : null}
						{error(errors.amount)}
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="cl-password">{t("card.cardless.password")}</Label>
						<Input
							id="cl-password"
							type="password"
							dir="ltr"
							inputMode="numeric"
							autoComplete="off"
							maxLength={limits?.maxPasswordLength ?? 12}
							className="max-w-64"
							value={password}
							aria-invalid={errors.password !== undefined}
							onChange={(event) => setPassword(digits(event.target.value))}
						/>
						<p className="text-xs text-muted-foreground">{t("card.cardless.passwordHint")}</p>
						{error(errors.password)}
					</div>

					<div className="flex items-center gap-2">
						<Checkbox id="cl-remember" checked={remember} onCheckedChange={(on) => setRemember(on === true)} />
						<Label htmlFor="cl-remember">{t("card.cardless.remember")}</Label>
					</div>

					<div className="flex justify-end gap-2">
						<Button asChild variant="outline">
							<Link to={routeMap.cardlessList.path}>{t("card.cardless.back")}</Link>
						</Button>
						<Button type="submit" disabled={config.isPending || cards.isPending}>
							{t("card.cardless.review")}
						</Button>
					</div>
				</form>
			)}

			{confirming && card ? (
				<IssueCardlessDialog cardId={card.id} cardNumber={card.number} mobile={mobile} amount={amountValue} password={password} remember={remember} onClose={() => setConfirming(false)} />
			) : null}
		</div>
	)
}

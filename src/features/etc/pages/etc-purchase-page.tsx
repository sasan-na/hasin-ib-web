import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { routeMap } from "@/app/routes"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { StepSection } from "@/components/flow/flow-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PasswordInput } from "@/features/auth/components/password-input"
import {
	cardCredentialInfoOptions,
	cardsOptions,
} from "@/features/card/api/card.queries"
import {
	CardCredentialsFields,
	EMPTY_CREDENTIALS,
	toCredentials,
	type CredentialsForm,
} from "@/features/card/components/card-credentials"
import {
	getEtcOwner,
	getEtcPrice,
	getMyNationalCode,
	getProvinces,
	LEGAL,
	NATURAL,
	purchaseEtc,
	type EtcOwner,
} from "@/features/etc/api/etc-purchase"
import { isNationalCode } from "@/features/etc/lib/national-code"
import { ConfirmDialog } from "@/features/transaction/components/confirm-dialog"
import { useSubmitTransaction } from "@/features/transaction/hooks/use-submit-transaction"
import { formatAmount, formatCardNumber } from "@/lib/format"
import { normalizeDigits } from "@/lib/normalize-digits"

// The bank's name for the text message that proves buying a tag from a card.
const CODE_SERVICE = "ETCPurchase"
const digits = (value: string): string =>
	normalizeDigits(value).replace(/\D/g, "")
const isTehranName = (name: string): boolean =>
	name === "تهران" || name.toLowerCase() === "tehran"

type Step = "owner" | "details" | "pay"

/** Buy a toll tag in three steps: who it is for, where to post it and under which website account, then pay from a card. */
export default function EtcPurchasePage() {
	const { t, i18n } = useTranslation()
	const language = i18n.language
	const provinces = useQuery({
		queryKey: ["etc", "provinces"],
		queryFn: getProvinces,
		staleTime: 60 * 60_000,
		retry: false,
	})
	const cards = useQuery(cardsOptions(language))
	const [step, setStep] = useState<Step>("owner")
	const [legal, setLegal] = useState(false)
	const [code, setCode] = useState("")
	const [owner, setOwner] = useState<EtcOwner | null>(null)
	const [customerType, setCustomerType] = useState(NATURAL)
	const [username, setUsername] = useState("")
	const [password, setPassword] = useState("")
	const [pickUsername, setPickUsername] = useState(false)
	const [firstName, setFirstName] = useState("")
	const [lastName, setLastName] = useState("")
	const [mobile, setMobile] = useState("")
	const [provinceCode, setProvinceCode] = useState("")
	const [cityCode, setCityCode] = useState("")
	const [postalCode, setPostalCode] = useState("")
	const [address, setAddress] = useState("")
	const [cardId, setCardId] = useState("")
	const [form, setForm] = useState<CredentialsForm>(EMPTY_CREDENTIALS)
	const [problem, setProblem] = useState("")
	const [confirming, setConfirming] = useState(false)

	const hasUser = owner?.hasUser === true
	const province = provinces.data?.find(
		(item) => String(item.code) === provinceCode,
	)
	const city = province?.cities.find((item) => String(item.code) === cityCode)
	const isTehran = province ? isTehranName(province.name) : false
	const price = useQuery({
		queryKey: ["etc", "price"],
		queryFn: getEtcPrice,
		enabled: step === "pay",
		staleTime: 0,
		retry: false,
	})
	const total = price.data
		? price.data.tag + (isTehran ? price.data.tehranPost : price.data.post)
		: 0
	const money = (value: number): string =>
		`${formatAmount(value, language)} ${t("etc.rial")}`

	const card = cards.data?.find((candidate) => String(candidate.id) === cardId)
	const info = useQuery({
		...cardCredentialInfoOptions(card?.id ?? 0, language),
		enabled: card !== undefined,
	})
	const credentials = card ? toCredentials(card.number, form, info.data) : null

	const lookUp = useMutation({
		mutationFn: () => getEtcOwner(code),
		onSuccess: (found) => {
			setOwner(found)
			setCustomerType(
				found && found.customerType > 0
					? found.customerType
					: legal
						? LEGAL
						: NATURAL,
			)
			setPickUsername(found?.hasUser === true && found.usernames.length > 0)
			setUsername("")
			setPassword("")
			setFirstName(found?.firstName ?? "")
			setLastName(found?.lastName ?? "")
			setMobile(found?.mobile ?? "")
			setPostalCode(found?.postalCode ?? "")
			setAddress(found?.address ?? "")
			const knownProvince = provinces.data?.find(
				(item) => item.code === found?.provinceCode,
			)
			setProvinceCode(knownProvince ? String(knownProvince.code) : "")
			setCityCode(
				knownProvince?.cities.some((item) => item.code === found?.cityCode)
					? String(found?.cityCode)
					: "",
			)
			setProblem("")
			setStep("details")
		},
		onError: () => setProblem(t("etc.purchase.error.lookup")),
	})

	const myCode = useMutation({
		mutationFn: getMyNationalCode,
		onSuccess: (mine) => setCode(digits(mine)),
		onError: () => setProblem(t("etc.purchase.error.mine")),
	})

	const sending = useSubmitTransaction({
		run: () => {
			if (!credentials || !province || !city || total <= 0)
				throw new Error("form incomplete")
			return purchaseEtc({
				credentials,
				customerType,
				nationalCode: legal ? "" : code,
				businessCode: legal ? code : (owner?.businessCode ?? ""),
				firstName: firstName.trim(),
				lastName: lastName.trim(),
				mobile,
				address: address.trim(),
				postalCode,
				provinceCode: province.code,
				cityCode: city.code,
				isTehran,
				amount: total,
				hasUser,
				username: username.trim(),
				password,
			})
		},
		again: { to: routeMap.etcPurchase.path, label: t("etc.purchase.again") },
		failedText: t("etc.purchase.failed"),
		uncertainText: t("etc.purchase.uncertain"),
	})

	const checkOwner = (): void => {
		if (legal ? !/^\d{6,15}$/.test(code) : !isNationalCode(code))
			return setProblem(
				legal
					? t("etc.purchase.error.business")
					: t("etc.purchase.error.national"),
			)
		setProblem("")
		lookUp.mutate()
	}

	const checkDetails = (): void => {
		if (username.trim() === "")
			return setProblem(t("etc.purchase.error.username"))
		if (!pickUsername && password.length < 8)
			return setProblem(t("etc.purchase.error.password"))
		if (firstName.trim() === "" || lastName.trim() === "")
			return setProblem(t("etc.purchase.error.name"))
		if (!/^09\d{9}$/.test(mobile))
			return setProblem(t("etc.purchase.error.mobile"))
		if (!province || !city) return setProblem(t("etc.purchase.error.place"))
		if (!/^\d{10}$/.test(postalCode))
			return setProblem(t("etc.purchase.error.postal"))
		if (address.trim() === "")
			return setProblem(t("etc.purchase.error.address"))
		setProblem("")
		setStep("pay")
	}

	const review = (): void => {
		if (price.isError || total <= 0)
			return setProblem(t("etc.purchase.error.price"))
		if (!card || !credentials) return setProblem(t("topup.error.card"))
		setProblem("")
		sending.reset()
		setConfirming(true)
	}

	const field = (id: string, label: string, children: React.ReactNode) => (
		<div className="flex flex-col gap-2">
			<Label htmlFor={id}>{label}</Label>
			{children}
		</div>
	)

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("etc.purchase.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.etcList.path}>{t("etc.purchase.back")}</Link>
				</Button>
			</div>
			<p className="text-muted-foreground text-sm">{t("etc.purchase.hint")}</p>

			{step === "owner" ? (
				<StepSection
					id="ep-step-owner"
					step={1}
					title={t("etc.purchase.stepTitle.owner")}
				>
					<div
						className="flex gap-4"
						role="radiogroup"
						aria-label={t("etc.purchase.kind")}
					>
						{[false, true].map((isLegal) => (
							<label
								key={String(isLegal)}
								className="flex items-center gap-2 text-sm"
							>
								<input
									type="radio"
									name="etc-kind"
									className="accent-primary"
									checked={legal === isLegal}
									onChange={() => {
										setLegal(isLegal)
										setCode("")
										setProblem("")
									}}
								/>
								{isLegal
									? t("etc.purchase.legal")
									: t("etc.purchase.individual")}
							</label>
						))}
					</div>
					{field(
						"ep-code",
						legal
							? t("etc.purchase.businessCode")
							: t("etc.purchase.nationalCode"),
						<>
							<Input
								id="ep-code"
								dir="ltr"
								inputMode="numeric"
								autoComplete="off"
								maxLength={legal ? 15 : 10}
								className="max-w-60"
								value={code}
								onChange={(event) => setCode(digits(event.target.value))}
							/>
							{legal ? null : (
								<div>
									<Button
										type="button"
										variant="link"
										size="sm"
										className="h-auto p-0"
										disabled={myCode.isPending}
										onClick={() => myCode.mutate()}
									>
										{t("etc.purchase.useMine")}
									</Button>
								</div>
							)}
						</>,
					)}
					<div>
						<Button
							type="button"
							disabled={lookUp.isPending || provinces.isPending}
							onClick={checkOwner}
						>
							{lookUp.isPending
								? t("etc.purchase.checking")
								: t("etc.purchase.next")}
						</Button>
					</div>
				</StepSection>
			) : null}

			{step === "details" ? (
				<StepSection
					id="ep-step-details"
					step={2}
					title={t("etc.purchase.stepTitle.details")}
				>
					{hasUser ? (
						<p className="text-muted-foreground text-sm">
							{t("etc.purchase.hasUser")}
						</p>
					) : null}
					{pickUsername ? (
						<>
							{field(
								"ep-user-pick",
								t("etc.purchase.username"),
								<Select value={username} onValueChange={setUsername}>
									<SelectTrigger id="ep-user-pick" className="w-full">
										<SelectValue
											placeholder={t("etc.purchase.chooseUsername")}
										/>
									</SelectTrigger>
									<SelectContent>
										{(owner?.usernames ?? []).map((name) => (
											<SelectItem key={name} value={name}>
												{name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>,
							)}
							<div>
								<Button
									type="button"
									variant="link"
									size="sm"
									className="h-auto p-0"
									onClick={() => {
										setPickUsername(false)
										setUsername("")
									}}
								>
									{t("etc.purchase.newUser")}
								</Button>
							</div>
						</>
					) : (
						<>
							{field(
								"ep-user",
								t("etc.purchase.username"),
								<Input
									id="ep-user"
									dir="ltr"
									autoComplete="off"
									value={username}
									onChange={(event) => setUsername(event.target.value)}
								/>,
							)}
							{hasUser && (owner?.usernames.length ?? 0) > 0 ? (
								<div>
									<Button
										type="button"
										variant="link"
										size="sm"
										className="h-auto p-0"
										onClick={() => setPickUsername(true)}
									>
										{t("etc.purchase.pickUser")}
									</Button>
								</div>
							) : null}
							{field(
								"ep-pass",
								t("etc.purchase.password"),
								<>
									<PasswordInput
										id="ep-pass"
										autoComplete="new-password"
										value={password}
										onChange={(event) => setPassword(event.target.value)}
									/>
									<p className="text-muted-foreground text-xs">
										{t("etc.purchase.passwordHelp")}
									</p>
								</>,
							)}
						</>
					)}
					<div className="grid gap-4 sm:grid-cols-2">
						{field(
							"ep-first",
							t("etc.purchase.firstName"),
							<Input
								id="ep-first"
								maxLength={50}
								disabled={hasUser}
								value={firstName}
								onChange={(event) => setFirstName(event.target.value)}
							/>,
						)}
						{field(
							"ep-last",
							t("etc.purchase.lastName"),
							<Input
								id="ep-last"
								maxLength={50}
								disabled={hasUser}
								value={lastName}
								onChange={(event) => setLastName(event.target.value)}
							/>,
						)}
					</div>
					{field(
						"ep-mobile",
						t("etc.purchase.mobile"),
						<Input
							id="ep-mobile"
							dir="ltr"
							inputMode="numeric"
							autoComplete="off"
							maxLength={11}
							className="max-w-60"
							value={mobile}
							onChange={(event) => setMobile(digits(event.target.value))}
						/>,
					)}
					<div className="grid gap-4 sm:grid-cols-2">
						{field(
							"ep-province",
							t("etc.purchase.province"),
							provinces.isPending ? (
								<Skeleton className="h-9 w-full" />
							) : provinces.isError ? (
								<p role="alert" className="text-destructive text-sm">
									{t("etc.purchase.error.provinces")}
								</p>
							) : (
								<Select
									value={provinceCode}
									onValueChange={(next) => {
										setProvinceCode(next)
										setCityCode("")
									}}
								>
									<SelectTrigger id="ep-province" className="w-full">
										<SelectValue
											placeholder={t("etc.purchase.chooseProvince")}
										/>
									</SelectTrigger>
									<SelectContent>
										{provinces.data.map((item) => (
											<SelectItem key={item.code} value={String(item.code)}>
												{item.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							),
						)}
						{field(
							"ep-city",
							t("etc.purchase.city"),
							<Select
								value={cityCode}
								onValueChange={setCityCode}
								disabled={!province}
							>
								<SelectTrigger id="ep-city" className="w-full">
									<SelectValue placeholder={t("etc.purchase.chooseCity")} />
								</SelectTrigger>
								<SelectContent>
									{(province?.cities ?? []).map((item) => (
										<SelectItem key={item.code} value={String(item.code)}>
											{item.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>,
						)}
					</div>
					{field(
						"ep-postal",
						t("etc.purchase.postalCode"),
						<Input
							id="ep-postal"
							dir="ltr"
							inputMode="numeric"
							autoComplete="off"
							maxLength={10}
							className="max-w-60"
							value={postalCode}
							onChange={(event) => setPostalCode(digits(event.target.value))}
						/>,
					)}
					{field(
						"ep-address",
						t("etc.purchase.address"),
						<textarea
							id="ep-address"
							rows={4}
							maxLength={300}
							className="rounded-md border bg-transparent px-3 py-2 text-sm"
							value={address}
							onChange={(event) => setAddress(event.target.value)}
						/>,
					)}
					<div className="flex gap-2">
						<Button type="button" onClick={checkDetails}>
							{t("etc.purchase.next")}
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								setProblem("")
								setStep("owner")
							}}
						>
							{t("etc.purchase.previous")}
						</Button>
					</div>
				</StepSection>
			) : null}

			{step === "pay" ? (
				<StepSection
					id="ep-step-pay"
					step={3}
					title={t("etc.purchase.stepTitle.pay")}
				>
					<dl className="grid gap-2 text-sm">
						<div className="flex justify-between gap-3">
							<dt className="text-muted-foreground">
								{t("etc.purchase.count")}
							</dt>
							<dd>{formatAmount(1, language)}</dd>
						</div>
						{price.data ? (
							<>
								<div className="flex justify-between gap-3">
									<dt className="text-muted-foreground">
										{t("etc.purchase.tagPrice")}
									</dt>
									<dd>{money(price.data.tag)}</dd>
								</div>
								<div className="flex justify-between gap-3">
									<dt className="text-muted-foreground">
										{t("etc.purchase.postPrice")}
									</dt>
									<dd>
										{money(isTehran ? price.data.tehranPost : price.data.post)}
									</dd>
								</div>
								<div className="flex justify-between gap-3 font-semibold">
									<dt>{t("etc.purchase.total")}</dt>
									<dd>{money(total)}</dd>
								</div>
							</>
						) : price.isError ? (
							<p role="alert" className="text-destructive">
								{t("etc.purchase.error.price")}
							</p>
						) : (
							<Skeleton className="h-16 w-full" />
						)}
					</dl>
					{field(
						"ep-card",
						t("topup.card"),
						cards.isPending ? (
							<Skeleton className="h-9 w-full" />
						) : cards.isError ? (
							<p role="alert" className="text-destructive text-sm">
								{t("topup.cardsError")}
							</p>
						) : (
							<Select
								value={cardId}
								onValueChange={(next) => {
									setCardId(next)
									setForm(EMPTY_CREDENTIALS)
								}}
							>
								<SelectTrigger id="ep-card" className="w-full">
									<SelectValue placeholder={t("topup.chooseCard")} />
								</SelectTrigger>
								<SelectContent>
									{cards.data.map((candidate) => (
										<SelectItem key={candidate.id} value={String(candidate.id)}>
											<span>{candidate.name || candidate.type}</span>{" "}
											<span dir="ltr">
												{formatCardNumber(candidate.number)}
											</span>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						),
					)}
					{card ? (
						<CardCredentialsFields
							cardId={card.id}
							cardNumber={card.number}
							codeServiceName={CODE_SERVICE}
							value={form}
							onChange={setForm}
						/>
					) : null}
					<div className="flex gap-2">
						<Button type="button" onClick={review}>
							{t("etc.purchase.review")}
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								setProblem("")
								setStep("details")
							}}
						>
							{t("etc.purchase.previous")}
						</Button>
					</div>
				</StepSection>
			) : null}

			{problem ? (
				<Alert variant="destructive">
					<AlertDescription>{problem}</AlertDescription>
				</Alert>
			) : null}

			{confirming && card && province && city ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setConfirming(false)
					}}
					title={t("etc.purchase.confirmTitle")}
					description={t("etc.purchase.confirmQuestion")}
					summary={[
						{
							label: legal
								? t("etc.purchase.businessCode")
								: t("etc.purchase.nationalCode"),
							value: <span dir="ltr">{code}</span>,
						},
						{
							label: t("etc.purchase.owner"),
							value: `${firstName.trim()} ${lastName.trim()}`,
						},
						{
							label: t("etc.purchase.username"),
							value: <span dir="ltr">{username.trim()}</span>,
						},
						{
							label: t("etc.purchase.sendTo"),
							value: `${province.name}، ${city.name}`,
						},
						{
							label: t("topup.card"),
							value: <span dir="ltr">{formatCardNumber(card.number)}</span>,
						},
						{
							label: t("etc.purchase.total"),
							amount: true,
							value: money(total),
						},
					]}
					confirmLabel={t("topup.pay")}
					pendingLabel={t("topup.sending")}
					canConfirm={!sending.blocked}
					pending={sending.pending}
					error={sending.refusal}
					onConfirm={sending.submit}
				/>
			) : null}
		</div>
	)
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useSearchParams } from "react-router-dom"

import { routeMap } from "@/app/routes"
import { StepSection } from "@/components/flow/flow-form"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
	savePeriodicInvoice,
	type Period,
	type PeriodicInvoice,
	type StatementField,
} from "@/features/report/api/periodic"
import {
	periodicInvoicesOptions,
	periodicKeys,
	periodsOptions,
	statementFieldsOptions,
} from "@/features/report/api/periodic.queries"
import type { SourceAccount } from "@/features/transaction/api/transaction"
import { SourceAccountSelect } from "@/features/transaction/components/source-account-select"
import { formatJalali, jalaliToIso, parseJalali } from "@/lib/jalali"
import { normalizeDigits } from "@/lib/normalize-digits"

// The bank's name for the statement these invoices are made from: which accounts may have one.
const SERVICE = "AccountTotalStatement"
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Today in the user's time zone, as "YYYY-MM-DD". */
const todayIso = (): string => new Date().toLocaleDateString("sv-SE")
const tomorrowIso = (): string =>
	new Date(Date.now() + 86_400_000).toLocaleDateString("sv-SE")

/** Creates a periodic invoice, or edits the one named by `?id=`. */
export default function PeriodicFormPage() {
	const { t, i18n } = useTranslation()
	const language = i18n.language
	const [params] = useSearchParams()
	const idParam = params.get("id")
	const editing = idParam !== null
	const id = Number(idParam)
	const periods = useQuery(periodsOptions(language))
	const fields = useQuery(statementFieldsOptions(language))
	const invoices = useQuery({ ...periodicInvoicesOptions(), enabled: editing })
	const existing = editing
		? invoices.data?.find((invoice) => invoice.id === id)
		: undefined

	let body: React.ReactNode
	if (
		editing &&
		(!Number.isInteger(id) || id <= 0 || (invoices.isSuccess && !existing))
	)
		body = <Problem text={t("report.periodic.notFound")} />
	else if (periods.isError || fields.isError || invoices.isError)
		body = <Problem text={t("report.periodic.formError")} />
	else if (
		periods.isPending ||
		fields.isPending ||
		(editing && invoices.isPending)
	)
		body = <Skeleton className="h-96 w-full" aria-hidden="true" />
	else
		body = (
			<InvoiceForm
				key={existing?.id ?? 0}
				existing={existing ?? null}
				periods={periods.data}
				fields={fields.data}
			/>
		)

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
			<h1 className="text-2xl font-bold">
				{editing
					? t("report.periodic.editTitle")
					: t("report.periodic.newTitle")}
			</h1>
			{body}
		</div>
	)
}

function Problem({ text }: { text: string }) {
	return (
		<p
			role="alert"
			className="bg-card shadow-card text-destructive rounded-2xl p-5 text-sm"
		>
			{text}
		</p>
	)
}

function InvoiceForm({
	existing,
	periods,
	fields,
}: {
	existing: PeriodicInvoice | null
	periods: Period[]
	fields: StatementField[]
}) {
	const { t, i18n } = useTranslation()
	const persian = i18n.language !== "en"
	const navigate = useNavigate()
	const queryClient = useQueryClient()

	// A date already in the past cannot be a first date: start from tomorrow, as the old bank did.
	const startIso = ((): string => {
		const stored = existing ? existing.firstDate.slice(0, 10) : ""
		return /^\d{4}-\d{2}-\d{2}$/.test(stored) && stored > todayIso()
			? stored
			: tomorrowIso()
	})()
	const show = (iso: string): string =>
		persian ? formatJalali(new Date(`${iso}T12:00:00`)) : iso

	const [account, setAccount] = React.useState<SourceAccount | null>(null)
	const [interval, setInterval] = React.useState(
		existing ? String(existing.interval) : "",
	)
	const [email, setEmail] = React.useState(existing?.email ?? "")
	const [firstDate, setFirstDate] = React.useState(show(startIso))
	const [lang, setLang] = React.useState(
		existing?.language === "en-US"
			? "en-US"
			: existing
				? "fa-IR"
				: persian
					? "fa-IR"
					: "en-US",
	)
	const [chosen, setChosen] = React.useState<Set<string>>(
		() =>
			new Set(
				existing
					? existing.fields
					: fields.filter((field) => field.isDefault).map((field) => field.key),
			),
	)
	const [error, setError] = React.useState<string | null>(null)

	const dateIso = ((): string | null => {
		if (persian) {
			const parsed = parseJalali(firstDate)
			return parsed ? jalaliToIso(parsed) : null
		}
		return /^\d{4}-\d{2}-\d{2}$/.test(firstDate) &&
			!Number.isNaN(Date.parse(firstDate))
			? firstDate
			: null
	})()
	const dateProblem =
		firstDate === "" || dateIso === null
			? t("report.periodic.error.date")
			: dateIso <= todayIso()
				? t("report.periodic.error.future")
				: null
	const emailOk = EMAIL.test(email.trim())
	const ready =
		(existing !== null || account !== null) &&
		interval !== "" &&
		emailOk &&
		dateProblem === null &&
		chosen.size > 0

	const save = useMutation({
		mutationFn: () =>
			savePeriodicInvoice({
				editing: existing,
				userAccountId: account?.id ?? 0,
				interval: Number(interval),
				email: email.trim().toLowerCase(),
				firstDateIso: dateIso ?? "",
				language: lang,
				fields: fields
					.filter((field) => chosen.has(field.key))
					.map((field) => field.key),
			}),
		onSuccess: (result) => {
			if (result.ok) {
				void queryClient.invalidateQueries({ queryKey: periodicKeys.list })
				void navigate(routeMap.reportPeriodic.path)
				return
			}
			setError(result.message || t("report.periodic.saveFailed"))
		},
		// The save may have gone through: send the user to the list to check rather than inviting a duplicate.
		onError: () => setError(t("report.periodic.saveUncertain")),
	})

	const toggle = (key: string, on: boolean): void =>
		setChosen((current) => {
			const next = new Set(current)
			if (on) next.add(key)
			else next.delete(key)
			return next
		})

	return (
		<form
			className="flex flex-col gap-5"
			onSubmit={(event) => {
				event.preventDefault()
				setError(null)
				if (ready && !save.isPending) save.mutate()
			}}
		>
			<StepSection
				id="pi-who-step"
				step={1}
				title={t("report.periodic.whoStep")}
			>
				<div className="flex flex-col gap-2">
					<Label htmlFor="pi-account">{t("report.statement.account")}</Label>
					{existing ? (
						<p dir="ltr" className="text-sm font-medium">
							{existing.accountNumber}
						</p>
					) : (
						<SourceAccountSelect
							id="pi-account"
							serviceName={SERVICE}
							value={account?.id ?? null}
							onChange={setAccount}
						/>
					)}
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="flex flex-col gap-2">
						<Label htmlFor="pi-interval">{t("report.periodic.interval")}</Label>
						<Select value={interval} onValueChange={setInterval}>
							<SelectTrigger id="pi-interval" className="w-full">
								<SelectValue
									placeholder={t("report.periodic.chooseInterval")}
								/>
							</SelectTrigger>
							<SelectContent>
								{periods.map((period) => (
									<SelectItem key={period.code} value={String(period.code)}>
										{period.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="pi-language">{t("report.periodic.language")}</Label>
						<Select value={lang} onValueChange={setLang}>
							<SelectTrigger id="pi-language" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="fa-IR">
									{t("report.periodic.persian")}
								</SelectItem>
								<SelectItem value="en-US">
									{t("report.periodic.english")}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="pi-email">{t("report.periodic.email")}</Label>
					<Input
						id="pi-email"
						dir="ltr"
						type="email"
						maxLength={100}
						value={email}
						aria-invalid={email !== "" && !emailOk}
						aria-describedby={
							email !== "" && !emailOk ? "pi-email-error" : undefined
						}
						onChange={(event) => setEmail(event.target.value)}
					/>
					{email !== "" && !emailOk ? (
						<p
							id="pi-email-error"
							role="alert"
							className="text-destructive text-xs"
						>
							{t("report.periodic.error.email")}
						</p>
					) : null}
				</div>
			</StepSection>

			<StepSection
				id="pi-when-step"
				step={2}
				title={t("report.periodic.whenStep")}
			>
				<div className="flex flex-col gap-2">
					<Label htmlFor="pi-date">
						{persian
							? t("report.periodic.firstDatePersian")
							: t("report.periodic.firstDate")}
					</Label>
					<Input
						id="pi-date"
						dir="ltr"
						inputMode="numeric"
						autoComplete="off"
						value={firstDate}
						aria-invalid={dateProblem !== null}
						aria-describedby={dateProblem ? "pi-date-error" : undefined}
						onChange={(event) =>
							setFirstDate(normalizeDigits(event.target.value))
						}
					/>
					{dateProblem ? (
						<p
							id="pi-date-error"
							role="alert"
							className="text-destructive text-xs"
						>
							{dateProblem}
						</p>
					) : null}
				</div>

				<fieldset className="flex flex-col gap-3">
					<legend className="mb-1 text-sm font-medium">
						{t("report.periodic.fields")}
					</legend>
					<div className="grid gap-2 sm:grid-cols-2">
						{fields.map((field) => (
							<div key={field.key} className="flex items-center gap-2">
								<Checkbox
									id={`pf-${field.key}`}
									checked={chosen.has(field.key)}
									onCheckedChange={(on) => toggle(field.key, on === true)}
								/>
								<Label htmlFor={`pf-${field.key}`} className="font-normal">
									{field.title}
								</Label>
							</div>
						))}
					</div>
					{chosen.size === 0 ? (
						<p role="alert" className="text-destructive text-xs">
							{t("report.periodic.error.fields")}
						</p>
					) : null}
				</fieldset>
			</StepSection>

			{error ? (
				<p role="alert" className="text-destructive text-sm">
					{error}
				</p>
			) : null}
			<div className="flex justify-end gap-2">
				<Button asChild variant="outline">
					<Link to={routeMap.reportPeriodic.path}>
						{t("report.periodic.cancel")}
					</Link>
				</Button>
				<Button type="submit" disabled={!ready || save.isPending}>
					{save.isPending
						? t("report.periodic.saving")
						: t("report.periodic.save")}
				</Button>
			</div>
		</form>
	)
}

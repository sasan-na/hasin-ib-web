import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useSearchParams } from "react-router-dom"

import { routeMap } from "@/app/routes"
import { StepSection } from "@/components/flow/flow-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
	saveContact,
	type Contact,
	type ContactEntry,
	type ContactLimits,
} from "@/features/contact/api/contact"
import {
	contactKeys,
	contactLimitsOptions,
	contactOptions,
} from "@/features/contact/api/contact.queries"
import {
	EntryList,
	type DraftEntry,
} from "@/features/contact/components/entry-list"
import { isValidCardNumber, isValidIban } from "@/features/transfer/lib/numbers"

const EMPTY: Contact = {
	id: 0,
	name: "",
	family: "",
	mobile: "",
	email: "",
	accounts: [],
	cards: [],
	ibans: [],
	loanAccounts: [],
	loanCards: [],
	etcs: [],
}

type Kind = "account" | "card" | "iban"

/** Creates a contact, or edits the one named by `?id=`. */
export default function ContactFormPage() {
	const { t } = useTranslation()
	const [params] = useSearchParams()
	const idParam = params.get("id")
	const id = idParam === null ? 0 : Number(idParam)
	const editing = idParam !== null
	const valid = !editing || (Number.isInteger(id) && id > 0)

	const limits = useQuery(contactLimitsOptions())
	const existing = useQuery({
		...contactOptions(id),
		enabled: editing && valid,
	})

	let body: React.ReactNode
	if (!valid) body = <Problem text={t("contact.notFound")} />
	else if (limits.isError)
		body = <Problem text={limits.error.message || t("contact.limitsError")} />
	else if (editing && existing.isError)
		body = <Problem text={existing.error.message || t("contact.loadError")} />
	else if (limits.isPending || (editing && existing.isPending))
		body = <Skeleton className="h-96 w-full" aria-hidden="true" />
	else
		body = (
			<ContactForm
				key={id}
				initial={editing && existing.data ? existing.data : EMPTY}
				limits={limits.data}
			/>
		)

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<h1 className="text-2xl font-bold">
				{editing ? t("contact.editTitle") : t("contact.newTitle")}
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

let nextKey = 1
const draft = (entry?: ContactEntry): DraftEntry => ({
	key: nextKey++,
	name: entry?.name ?? "",
	number: entry?.number ?? "",
})
const drafts = (list: ContactEntry[]): DraftEntry[] =>
	list.map((entry) => draft(entry))
/** Only rows with a number are saved; the rest are blank rows the user never filled. */
const filled = (list: DraftEntry[]): ContactEntry[] =>
	list
		.filter((entry) => entry.number !== "")
		.map(({ name, number }) => ({ name: name.trim(), number }))

function ContactForm({
	initial,
	limits,
}: {
	initial: Contact
	limits: ContactLimits
}) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const queryClient = useQueryClient()

	const [name, setName] = React.useState(initial.name)
	const [family, setFamily] = React.useState(initial.family)
	const [mobile, setMobile] = React.useState(initial.mobile)
	const [email, setEmail] = React.useState(initial.email)
	const [accounts, setAccounts] = React.useState(() => drafts(initial.accounts))
	const [cards, setCards] = React.useState(() => drafts(initial.cards))
	const [ibans, setIbans] = React.useState(() => drafts(initial.ibans))
	const [error, setError] = React.useState<string | null>(null)

	const problemOf =
		(kind: Kind, list: DraftEntry[]) =>
		(entry: DraftEntry): string | null => {
			if (entry.number === "") return null
			const ok =
				kind === "account"
					? /^\d{10,22}$/.test(entry.number)
					: kind === "card"
						? isValidCardNumber(entry.number)
						: isValidIban(entry.number)
			if (!ok) return t(`contact.invalid.${kind}`)
			if (entry.name.trim() === "") return t("contact.invalid.entryTitle")
			if (
				list.some(
					(other) => other.key !== entry.key && other.number === entry.number,
				)
			)
				return t("contact.invalid.duplicate")
			return null
		}
	const accountProblem = problemOf("account", accounts)
	const cardProblem = problemOf("card", cards)
	const ibanProblem = problemOf("iban", ibans)

	const mobileOk = mobile === "" || /^09\d{9}$/.test(mobile)
	const emailOk = email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
	const anyDestination =
		mobile !== "" ||
		email !== "" ||
		[...accounts, ...cards, ...ibans].some((entry) => entry.number !== "")
	const entriesOk = [
		...accounts.map(accountProblem),
		...cards.map(cardProblem),
		...ibans.map(ibanProblem),
	].every((issue) => issue === null)

	const save = useMutation({
		mutationFn: () =>
			saveContact({
				...initial,
				name: name.trim(),
				family: family.trim(),
				mobile,
				email: email.trim(),
				accounts: filled(accounts),
				cards: filled(cards),
				ibans: filled(ibans),
			}),
		onSuccess: (result) => {
			if (result.ok) {
				void queryClient.invalidateQueries({ queryKey: contactKeys.all })
				void navigate(routeMap.contactList.path)
				return
			}
			setError(
				result.duplicate
					? t("contact.duplicatePerson")
					: result.message || t("contact.saveFailed"),
			)
		},
		// The save may have gone through: send the user to the list to check rather than inviting a second, duplicate save.
		onError: () => setError(t("contact.saveUncertain")),
	})

	const canSave =
		name.trim() !== "" &&
		family.trim() !== "" &&
		mobileOk &&
		emailOk &&
		anyDestination &&
		entriesOk &&
		!save.isPending

	return (
		<form
			className="flex flex-col gap-5"
			onSubmit={(event) => {
				event.preventDefault()
				setError(null)
				if (canSave) save.mutate()
			}}
		>
			<StepSection id="contact-person" step={1} title={t("contact.personStep")}>
				<div className="grid gap-4 sm:grid-cols-2">
					<Field id="contact-name" label={t("contact.name")}>
						<Input
							id="contact-name"
							value={name}
							maxLength={50}
							onChange={(event) => setName(event.target.value)}
						/>
					</Field>
					<Field id="contact-family" label={t("contact.family")}>
						<Input
							id="contact-family"
							value={family}
							maxLength={50}
							onChange={(event) => setFamily(event.target.value)}
						/>
					</Field>
					<Field
						id="contact-mobile"
						label={t("contact.mobile")}
						problem={mobileOk ? null : t("contact.invalid.mobile")}
					>
						<Input
							id="contact-mobile"
							dir="ltr"
							inputMode="numeric"
							maxLength={11}
							value={mobile}
							aria-invalid={!mobileOk}
							onChange={(event) =>
								setMobile(event.target.value.replace(/\D/g, ""))
							}
						/>
					</Field>
					<Field
						id="contact-email"
						label={t("contact.email")}
						problem={emailOk ? null : t("contact.invalid.email")}
					>
						<Input
							id="contact-email"
							dir="ltr"
							type="email"
							maxLength={100}
							value={email}
							aria-invalid={!emailOk}
							onChange={(event) => setEmail(event.target.value)}
						/>
					</Field>
				</div>
			</StepSection>

			<StepSection
				id="contact-destinations"
				step={2}
				title={t("contact.destinationsStep")}
			>
				<EntryList
					title={t("contact.accounts")}
					numberLabel={t("contact.accountNumber")}
					maxDigits={22}
					entries={accounts}
					max={limits.accounts}
					problem={accountProblem}
					onChange={setAccounts}
					onAdd={() => setAccounts([...accounts, draft()])}
				/>
				<EntryList
					title={t("contact.cards")}
					numberLabel={t("contact.cardNumber")}
					maxDigits={16}
					entries={cards}
					max={limits.cards}
					problem={cardProblem}
					onChange={setCards}
					onAdd={() => setCards([...cards, draft()])}
				/>
				<EntryList
					title={t("contact.ibans")}
					numberLabel={t("contact.ibanNumber")}
					maxDigits={24}
					prefix="IR"
					entries={ibans}
					max={limits.ibans}
					problem={ibanProblem}
					onChange={setIbans}
					onAdd={() => setIbans([...ibans, draft()])}
				/>
				{!anyDestination ? (
					<p className="text-muted-foreground text-sm">
						{t("contact.needOne")}
					</p>
				) : null}
			</StepSection>

			{error ? (
				<p role="alert" className="text-destructive text-sm">
					{error}
				</p>
			) : null}
			<div className="flex justify-end gap-2">
				<Button asChild variant="outline">
					<Link to={routeMap.contactList.path}>{t("contact.cancel")}</Link>
				</Button>
				<Button type="submit" disabled={!canSave}>
					{save.isPending ? t("contact.saving") : t("contact.save")}
				</Button>
			</div>
		</form>
	)
}

function Field({
	id,
	label,
	problem,
	children,
}: {
	id: string
	label: string
	problem?: string | null
	children: React.ReactNode
}) {
	return (
		<div className="flex flex-col gap-2">
			<label htmlFor={id} className="text-sm font-medium">
				{label}
			</label>
			{children}
			{problem ? (
				<p role="alert" className="text-destructive text-xs">
					{problem}
				</p>
			) : null}
		</div>
	)
}

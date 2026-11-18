import {Plus, Trash2} from "lucide-react"
import type {Dispatch, SetStateAction} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {getRecipientName, type PersonType, type Recipient} from "@/features/cheque/api/pichak-register"
import {normalizeDigits} from "@/lib/normalize-digits"

const TYPES: PersonType[] = [1, 2, 3, 4]
// How long the id of each kind is: a national id has exactly 10 digits, a foreigner's 12, a company's 1 to 20.
const ID_LENGTH: Record<PersonType, {min: number; max: number}> = {1: {min: 10, max: 10}, 2: {min: 1, max: 20}, 3: {min: 12, max: 12}, 4: {min: 1, max: 20}}

export interface RecipientRow {
	key: number
	idType: PersonType
	idCode: string
	/** Filled from the registry; empty until the lookup has answered for this id. */
	name: string
	checking: boolean
	problem: string | null
}

const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")

export const newRecipientRow = (key: number): RecipientRow => ({key, idType: 1, idCode: "", name: "", checking: false, problem: null})

export const toRecipients = (rows: RecipientRow[]): Recipient[] => rows.map((row) => ({name: row.name, idType: row.idType, idCode: row.idCode}))

/** Marks the rows that are not ready (no registered name yet, or listed twice) and says whether every row is fine. */
export const checkRecipients = (rows: RecipientRow[], messages: {notChecked: string; duplicate: string}): {rows: RecipientRow[]; ok: boolean} => {
	const seen = new Set<string>()
	let ok = true
	const checked = rows.map((row) => {
		let problem: string | null = null
		if (row.name === "") problem = messages.notChecked
		else if (seen.has(`${row.idType}-${row.idCode}`)) problem = messages.duplicate
		seen.add(`${row.idType}-${row.idCode}`)
		if (problem) ok = false
		return problem === row.problem ? row : {...row, problem}
	})
	return {rows: checked, ok}
}

interface Props {
	sayyadId: string
	rows: RecipientRow[]
	setRows: Dispatch<SetStateAction<RecipientRow[]>>
	/** Heading above the list. */
	title: string
	/** The fewest rows the list may have; 0 lets the user remove every row. Default 1. */
	minRows?: number
}

/** The people a cheque is payable to: each one is looked up in the registry so the name cannot be typed wrongly. */
export function RecipientsEditor({sayyadId, rows, setRows, title, minRows = 1}: Props) {
	const {t} = useTranslation()

	const update = (key: number, change: Partial<RecipientRow>): void => setRows((current) => current.map((row) => (row.key === key ? {...row, ...change} : row)))

	const lookup = async (row: RecipientRow): Promise<void> => {
		const {min, max} = ID_LENGTH[row.idType]
		if (row.idCode.length < min || row.idCode.length > max) {
			update(row.key, {problem: t("cheque.register.error.idLength", {min, max})})
			return
		}
		update(row.key, {checking: true, problem: null, name: ""})
		try {
			const name = await getRecipientName({sayyadId, idType: row.idType, idCode: row.idCode})
			// Ignore the answer when the id was edited meanwhile.
			setRows((current) => current.map((candidate) => (candidate.key === row.key && candidate.idCode === row.idCode && candidate.idType === row.idType ? {...candidate, name, checking: false} : candidate)))
		} catch (error) {
			const message = error instanceof Error && error.message ? error.message : t("cheque.register.error.lookup")
			setRows((current) => current.map((candidate) => (candidate.key === row.key ? {...candidate, checking: false, problem: message} : candidate)))
		}
	}

	return (
		<section className="flex flex-col gap-3">
			<h2 className="text-base font-semibold">{title}</h2>
			<ul className="flex flex-col gap-3">
				{rows.map((row, index) => (
					<li key={row.key} className="flex flex-col gap-3 rounded-md border p-4">
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium text-muted-foreground">{t("cheque.register.recipient", {number: index + 1})}</span>
							{rows.length > minRows ? (
								<Button type="button" variant="ghost" size="icon" aria-label={t("cheque.register.remove", {number: index + 1})} onClick={() => setRows((current) => current.filter((candidate) => candidate.key !== row.key))}>
									<Trash2 aria-hidden="true" />
								</Button>
							) : null}
						</div>
						<div className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
							<div className="flex flex-col gap-2">
								<Label htmlFor={`rc-type-${row.key}`}>{t("cheque.register.personType")}</Label>
								<Select value={String(row.idType)} onValueChange={(value) => update(row.key, {idType: Number(value) as PersonType, name: "", problem: null})}>
									<SelectTrigger id={`rc-type-${row.key}`} className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{TYPES.map((type) => (
											<SelectItem key={type} value={String(type)}>
												{t(`cheque.pichak.customerTypeCodes.${type}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-2">
								<Label htmlFor={`rc-code-${row.key}`}>{t("cheque.register.idCode")}</Label>
								<Input
									id={`rc-code-${row.key}`}
									dir="ltr"
									inputMode="numeric"
									autoComplete="off"
									maxLength={ID_LENGTH[row.idType].max}
									value={row.idCode}
									aria-invalid={row.problem !== null}
									onChange={(event) => update(row.key, {idCode: digits(event.target.value), name: "", problem: null})}
									onKeyDown={(event) => {
										if (event.key === "Enter") {
											event.preventDefault()
											void lookup(row)
										}
									}}
								/>
							</div>
							<Button type="button" variant="outline" disabled={row.checking || row.idCode === ""} onClick={() => void lookup(row)}>
								{row.checking ? t("cheque.register.checking") : t("cheque.register.check")}
							</Button>
						</div>
						{row.name ? (
							<p role="status" className="text-sm font-medium text-success">
								{t("cheque.register.registeredName", {name: row.name})}
							</p>
						) : null}
						{row.problem ? (
							<p role="alert" className="text-sm text-destructive">
								{row.problem}
							</p>
						) : null}
					</li>
				))}
			</ul>
			<div>
				<Button type="button" variant="outline" size="sm" onClick={() => setRows((current) => [...current, newRecipientRow(Math.max(0, ...current.map((row) => row.key)) + 1)])}>
					<Plus aria-hidden="true" />
					{t("cheque.register.addRecipient")}
				</Button>
			</div>
		</section>
	)
}

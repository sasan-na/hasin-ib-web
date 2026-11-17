import {Plus, Trash2} from "lucide-react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"

/** One row being typed: `key` identifies it while rows are added and removed. */
export interface DraftEntry {
	key: number
	name: string
	number: string
}

interface Props {
	title: string
	numberLabel: string
	/** Longest number the field accepts. */
	maxDigits: number
	entries: DraftEntry[]
	max: number
	/** Explains why a row is wrong, or null when it is fine. */
	problem: (entry: DraftEntry) => string | null
	onChange: (entries: DraftEntry[]) => void
	onAdd: () => void
	/** Shown before the number, like "IR" for an IBAN. */
	prefix?: string
}

/** A titled list of number + title rows with add and remove, used for a contact's accounts, cards and IBANs. */
export function EntryList({title, numberLabel, maxDigits, entries, max, problem, onChange, onAdd, prefix}: Props) {
	const {t} = useTranslation()

	const update = (key: number, change: Partial<DraftEntry>) => onChange(entries.map((entry) => (entry.key === key ? {...entry, ...change} : entry)))

	return (
		<fieldset className="flex flex-col gap-3 rounded-lg border bg-card p-4">
			<legend className="px-1 text-sm font-semibold">{title}</legend>
			{entries.length === 0 ? <p className="text-sm text-muted-foreground">{t("contact.noEntries")}</p> : null}
			{entries.map((entry) => {
				const issue = problem(entry)
				return (
					<div key={entry.key} className="flex flex-col gap-1">
						<div className="flex items-center gap-2">
							<div className="flex min-w-0 flex-1 items-center gap-1" dir="ltr">
								{prefix ? <span className="text-sm text-muted-foreground">{prefix}</span> : null}
								<Input
									inputMode="numeric"
									dir="ltr"
									aria-label={numberLabel}
									placeholder={numberLabel}
									maxLength={maxDigits}
									value={entry.number}
									aria-invalid={issue !== null}
									onChange={(event) => update(entry.key, {number: event.target.value.replace(/\D/g, "")})}
								/>
							</div>
							<Input
								className="flex-1"
								aria-label={t("contact.entryTitle")}
								placeholder={t("contact.entryTitle")}
								maxLength={50}
								value={entry.name}
								onChange={(event) => update(entry.key, {name: event.target.value})}
							/>
							<Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={t("contact.removeEntry")} onClick={() => onChange(entries.filter((item) => item.key !== entry.key))}>
								<Trash2 aria-hidden="true" />
							</Button>
						</div>
						{issue ? (
							<p role="alert" className="text-xs text-destructive">
								{issue}
							</p>
						) : null}
					</div>
				)
			})}
			<Button type="button" variant="outline" size="sm" className="self-start" disabled={entries.length >= max} onClick={onAdd}>
				<Plus aria-hidden="true" />
				{t("contact.addEntry")}
			</Button>
		</fieldset>
	)
}

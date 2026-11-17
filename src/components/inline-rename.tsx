import {useMutation} from "@tanstack/react-query"
import {Check, Pencil, X} from "lucide-react"
import {useState} from "react"

import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"

const NAME_MAX = 30

export interface InlineRenameLabels {
	/** Accessible names for the pencil, tick and cross buttons, and the field. */
	rename: string
	save: string
	cancel: string
	field: string
	/** Shown when the name is left empty / when the bank refused. */
	required: string
	failed: string
}

interface InlineRenameProps {
	name: string
	/** Sends the new name. It should throw when the bank refuses. */
	save: (newName: string) => Promise<void>
	/** Runs after a successful save, for example to refresh the lists that show the name. */
	onSaved: () => Promise<unknown> | void
	labels: InlineRenameLabels
}

/** A name with an inline edit: pencil to start, tick (or Enter) to save, cross (or Escape) to cancel. */
export function InlineRename({name, save, onSaved, labels}: InlineRenameProps) {
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState(name)
	const [problem, setProblem] = useState<string | null>(null)

	const mutation = useMutation({
		mutationFn: save,
		onSuccess: async () => {
			await onSaved()
			setEditing(false)
		},
		onError: () => setProblem(labels.failed),
	})

	const start = (): void => {
		setDraft(name)
		setProblem(null)
		setEditing(true)
	}

	const cancel = (): void => {
		setEditing(false)
		setProblem(null)
	}

	const submit = (): void => {
		const trimmed = draft.trim()
		if (trimmed === "") {
			setProblem(labels.required)
			return
		}
		if (trimmed === name) {
			cancel()
			return
		}
		setProblem(null)
		mutation.mutate(trimmed)
	}

	if (!editing) {
		return (
			<div className="flex items-center gap-2">
				<span className="wrap-break-word">{name || "-"}</span>
				<Button type="button" variant="ghost" size="icon" className="size-7" aria-label={labels.rename} onClick={start}>
					<Pencil aria-hidden="true" className="size-4" />
				</Button>
			</div>
		)
	}

	return (
		<form
			className="flex flex-col gap-2"
			onSubmit={(event) => {
				event.preventDefault()
				submit()
			}}
		>
			<div className="flex items-center gap-2">
				<Input
					autoFocus
					value={draft}
					maxLength={NAME_MAX}
					disabled={mutation.isPending}
					aria-label={labels.field}
					aria-invalid={problem !== null}
					onChange={(event) => {
						setDraft(event.target.value)
						setProblem(null)
					}}
					onKeyDown={(event) => {
						if (event.key === "Escape") cancel()
					}}
					className="max-w-64"
				/>
				<Button type="submit" size="icon" className="size-8" disabled={mutation.isPending} aria-label={labels.save}>
					<Check aria-hidden="true" className="size-4" />
				</Button>
				<Button type="button" variant="outline" size="icon" className="size-8" disabled={mutation.isPending} aria-label={labels.cancel} onClick={cancel}>
					<X aria-hidden="true" className="size-4" />
				</Button>
			</div>
			{problem ? (
				<p role="alert" className="text-sm text-destructive">
					{problem}
				</p>
			) : null}
		</form>
	)
}

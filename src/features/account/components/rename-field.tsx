import {useMutation, useQueryClient} from "@tanstack/react-query"
import {Check, Pencil, X} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {renameAccount} from "@/features/account/api/account"
import {accountKeys} from "@/features/account/api/account.queries"

const NAME_MAX = 30

interface RenameFieldProps {
	accountId: number
	name: string
}

/** The account's name with an inline edit: pencil to start, tick to save, cross to cancel. */
export function RenameField({accountId, name}: RenameFieldProps) {
	const {t} = useTranslation()
	const queryClient = useQueryClient()
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState(name)
	const [problem, setProblem] = useState<string | null>(null)

	const save = useMutation({
		mutationFn: (newName: string) => renameAccount(accountId, newName),
		onSuccess: async () => {
			// The list and this page both show the name.
			await queryClient.invalidateQueries({queryKey: accountKeys.all})
			setEditing(false)
		},
		onError: () => setProblem(t("account.info.renameError")),
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
			setProblem(t("account.info.nameRequired"))
			return
		}
		if (trimmed === name) {
			cancel()
			return
		}
		setProblem(null)
		save.mutate(trimmed)
	}

	if (!editing) {
		return (
			<div className="flex items-center gap-2">
				<span className="wrap-break-word">{name || "-"}</span>
				<Button type="button" variant="ghost" size="icon" className="size-7" aria-label={t("account.info.rename")} onClick={start}>
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
					disabled={save.isPending}
					aria-label={t("account.info.name")}
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
				<Button type="submit" size="icon" className="size-8" disabled={save.isPending} aria-label={t("account.info.save")}>
					<Check aria-hidden="true" className="size-4" />
				</Button>
				<Button type="button" variant="outline" size="icon" className="size-8" disabled={save.isPending} aria-label={t("account.info.cancel")} onClick={cancel}>
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

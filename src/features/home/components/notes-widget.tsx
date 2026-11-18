import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {ChevronLeft, ChevronRight, Pencil, Trash2} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Skeleton} from "@/components/ui/skeleton"
import {addNote, deleteNote, editNote, getCalendarMonth, getCurrentMonth, getMaxNoteCount} from "@/features/home/api/notes"
import {formatAmount} from "@/lib/format"
import {cn} from "@/lib/utils"

// 2024-01-06 was a Saturday: the bank's weeks run Saturday to Friday in both languages.
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

/** A month calendar with holidays, occasions and the user's own notes for each day. */
export function NotesWidget() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const queryClient = useQueryClient()
	const today = useQuery({queryKey: ["home", "notes", "today", language], queryFn: getCurrentMonth, staleTime: 60 * 60_000, retry: false})
	const maxCount = useQuery({queryKey: ["home", "notes", "max"], queryFn: getMaxNoteCount, staleTime: 10 * 60_000, retry: false})
	const [shown, setShown] = useState<{year: number; month: number} | null>(null)
	const [picked, setPicked] = useState<number | null>(null)
	const [text, setText] = useState("")
	const [editing, setEditing] = useState<number | null>(null)
	const [refusal, setRefusal] = useState<string | null>(null)

	const current = shown ?? today.data ?? null
	const month = useQuery({
		queryKey: ["home", "notes", "month", language, current?.year, current?.month],
		queryFn: () => getCalendarMonth(current?.year ?? 0, current?.month ?? 0, language !== "en"),
		enabled: current !== null,
		staleTime: 30_000,
		retry: false,
	})

	const days = month.data?.days ?? []
	const selected = days.find((day) => day.number === picked) ?? days.find((day) => day.isToday) ?? null

	const refresh = (): void => void queryClient.invalidateQueries({queryKey: ["home", "notes", "month"]})
	const save = useMutation({
		mutationFn: () => {
			const title = text.trim()
			if (editing !== null) return editNote(editing, title)
			return addNote(title, current?.year ?? 0, current?.month ?? 0, selected?.number ?? 1)
		},
		onSuccess: () => {
			setText("")
			setEditing(null)
			setRefusal(null)
			refresh()
		},
		onError: (error: Error) => setRefusal(error.message || t("home.notes.failed")),
	})
	const remove = useMutation({
		mutationFn: (id: number) => deleteNote(id),
		onSuccess: refresh,
		onError: (error: Error) => setRefusal(error.message || t("home.notes.failed")),
	})

	const move = (by: number): void => {
		if (!current) return
		const index = current.year * 12 + (current.month - 1) + by
		setShown({year: Math.floor(index / 12), month: (index % 12) + 1})
		setPicked(1)
		setEditing(null)
		setText("")
	}

	const full = selected !== null && editing === null && selected.notes.length >= (maxCount.data ?? 1)
	const locale = language === "en" ? "en-US" : "fa-IR"

	return (
		<section aria-labelledby="notes-title" className="overflow-hidden rounded-lg bg-card">
			<div className="flex items-center justify-between gap-2 border-b px-5 py-3">
				<h2 id="notes-title" className="text-base font-semibold">
					{t("home.notes.title")}
				</h2>
				<div className="flex items-center gap-1">
					<Button type="button" variant="ghost" size="icon" aria-label={t("home.notes.previous")} onClick={() => move(-1)} disabled={!current}>
						{i18n.dir() === "rtl" ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
					</Button>
					<span className="min-w-28 text-center text-sm font-medium">{month.data?.title || (month.data?.titles[0] ?? "")}</span>
					<Button type="button" variant="ghost" size="icon" aria-label={t("home.notes.next")} onClick={() => move(1)} disabled={!current}>
						{i18n.dir() === "rtl" ? <ChevronLeft aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
					</Button>
				</div>
			</div>

			{today.isError || month.isError ? (
				<p role="alert" className="p-5 text-sm text-destructive">
					{t("home.notes.error")}
				</p>
			) : !month.data ? (
				<div className="p-5">
					<Skeleton className="h-48 w-full" />
				</div>
			) : (
				<div className="flex flex-col gap-4 p-5">
					<div className="grid grid-cols-7 gap-1 text-center text-xs">
						{WEEKDAYS.map((index) => (
							<span key={index} className="py-1 text-muted-foreground">
								{new Date(2024, 0, 6 + index).toLocaleDateString(locale, {weekday: "narrow"})}
							</span>
						))}
						{Array.from({length: Math.max(0, month.data.startDay - 1)}, (_, index) => (
							<span key={`blank-${index}`} />
						))}
						{days.map((day) => (
							<button
								key={day.number}
								type="button"
								aria-pressed={selected?.number === day.number}
								onClick={() => {
									setPicked(day.number)
									setEditing(null)
									setText("")
								}}
								className={cn(
									"relative rounded-md py-1.5 text-sm tabular-nums transition-colors hover:bg-accent",
									// Friday is a day off whatever the bank's holiday list says; the weeks run Saturday to Friday.
									(day.isHoliday || (month.data.startDay - 1 + day.number - 1) % 7 === 6) && "text-destructive",
									day.isToday && "font-bold ring-1 ring-primary",
									selected?.number === day.number && "bg-accent",
								)}
							>
								{formatAmount(day.number, language)}
								{day.notes.length > 0 ? <span aria-hidden="true" className="absolute bottom-0.5 start-1/2 size-1 -translate-x-1/2 rounded-full bg-primary" /> : null}
							</button>
						))}
					</div>

					{selected ? (
						<div className="flex flex-col gap-3 border-t pt-4">
							<p className="text-sm font-medium">{selected.other}</p>
							{selected.events.length > 0 ? (
								<ul className="list-disc ps-5 text-xs text-muted-foreground">
									{selected.events.map((event) => (
										<li key={event}>{event}</li>
									))}
								</ul>
							) : null}
							{selected.notes.length === 0 ? <p className="text-xs text-muted-foreground">{t("home.notes.none")}</p> : null}
							<ul className="flex flex-col gap-2">
								{selected.notes.map((note) => (
									<li key={note.id} className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm">
										<span className="wrap-break-word">{note.title}</span>
										<span className="flex shrink-0 gap-1">
											<Button
												type="button"
												variant="ghost"
												size="icon"
												aria-label={t("home.notes.edit")}
												onClick={() => {
													setEditing(note.id)
													setText(note.title)
													setRefusal(null)
												}}
											>
												<Pencil aria-hidden="true" />
											</Button>
											<Button type="button" variant="ghost" size="icon" aria-label={t("home.notes.delete")} disabled={remove.isPending} onClick={() => remove.mutate(note.id)}>
												<Trash2 aria-hidden="true" />
											</Button>
										</span>
									</li>
								))}
							</ul>
							<form
								className="flex gap-2"
								onSubmit={(event) => {
									event.preventDefault()
									if (text.trim() !== "" && !save.isPending && !full) save.mutate()
								}}
							>
								<Input value={text} maxLength={200} disabled={full} placeholder={full ? t("home.notes.full") : t("home.notes.placeholder")} aria-label={t("home.notes.placeholder")} onChange={(event) => setText(event.target.value)} />
								<Button type="submit" size="sm" disabled={text.trim() === "" || save.isPending || full}>
									{editing !== null ? t("home.notes.save") : t("home.notes.add")}
								</Button>
								{editing !== null ? (
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() => {
											setEditing(null)
											setText("")
										}}
									>
										{t("home.notes.cancel")}
									</Button>
								) : null}
							</form>
							{refusal ? (
								<p role="alert" className="text-xs text-destructive">
									{refusal}
								</p>
							) : null}
						</div>
					) : null}
				</div>
			)}
		</section>
	)
}

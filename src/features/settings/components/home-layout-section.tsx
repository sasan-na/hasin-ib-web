import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {ArrowDown, ArrowUp, Plus, Trash2} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {Alert, AlertDescription} from "@/components/ui/alert"
import {Button} from "@/components/ui/button"
import {Checkbox} from "@/components/ui/checkbox"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {type Arrangement, type ArrangementRow, saveArrangement, type WidgetKey, WIDGET_KEYS} from "@/features/home/api/arrangement"
import {arrangementOptions, homeKeys} from "@/features/home/api/home.queries"

// How a row can be split: the widths of its columns in twelfths.
const LAYOUTS: readonly (readonly number[])[] = [[6, 6], [4, 8], [8, 4], [5, 7], [7, 5], [12]]
const layoutKey = (widths: readonly number[]): string => widths.join("-")
const NONE = "none"

/** Which pieces the home page shows below the wallet, and in what rows and widths. */
export function HomeLayoutSection() {
	const query = useQuery(arrangementOptions())
	if (query.isPending) return <Skeleton className="h-32 w-full" />
	if (query.isError) return <LoadError />
	// No key on the data: the editor keeps what the user is doing (and its saved notice) when the layout is refetched after saving.
	return <Editor initial={query.data} />
}

function LoadError() {
	const {t} = useTranslation()
	return (
		<section className="rounded-2xl bg-card p-5 shadow-card">
			<h2 className="text-base font-semibold">{t("settings.home.title")}</h2>
			<p role="alert" className="mt-2 text-sm text-destructive">
				{t("settings.home.loadError")}
			</p>
		</section>
	)
}

function Editor({initial}: {initial: Arrangement}) {
	const {t} = useTranslation()
	const queryClient = useQueryClient()
	const [useDefault, setUseDefault] = useState(initial.useDefault)
	const [rows, setRows] = useState<ArrangementRow[]>(initial.rows)
	const [problem, setProblem] = useState("")
	const [notice, setNotice] = useState("")

	const used = new Set(rows.flatMap((row) => row.columns.map((column) => column.widget)).filter((widget) => widget !== ""))
	const save = useMutation({
		mutationFn: (next: Arrangement) => saveArrangement(next),
		onSuccess: () => {
			setNotice(t("settings.home.saved"))
			void queryClient.invalidateQueries({queryKey: homeKeys.arrangement()})
		},
		onError: (error: Error) => setProblem(error.message || t("settings.home.failed")),
	})

	const addRow = (): void => setRows((current) => [...current, {index: current.length, columns: [{index: 0, width: 12, widget: ""}]}])
	const patchRow = (at: number, change: (row: ArrangementRow) => ArrangementRow): void => setRows((current) => current.map((row, index) => (index === at ? change(row) : row)))
	const setLayout = (at: number, widths: readonly number[]): void => patchRow(at, (row) => ({...row, columns: widths.map((width, index) => ({index, width, widget: row.columns[index]?.widget ?? ""}))}))
	const setWidget = (at: number, column: number, widget: WidgetKey | ""): void => patchRow(at, (row) => ({...row, columns: row.columns.map((item, index) => (index === column ? {...item, widget} : item))}))
	const move = (at: number, by: number): void =>
		setRows((current) => {
			const target = at + by
			if (target < 0 || target >= current.length) return current
			const next = [...current]
			;[next[at], next[target]] = [next[target], next[at]]
			return next
		})

	const submit = (): void => {
		setNotice("")
		if (!useDefault && rows.some((row) => row.columns.every((column) => column.widget === ""))) return setProblem(t("settings.home.emptyRow"))
		setProblem("")
		save.mutate({useDefault, rows: useDefault ? [] : rows})
	}

	return (
		<section className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-card" aria-labelledby="home-layout-title">
			<h2 id="home-layout-title" className="text-base font-semibold">
				{t("settings.home.title")}
			</h2>
			<p className="text-sm text-muted-foreground">{t("settings.home.hint")}</p>
			<div className="flex items-center gap-2">
				<Checkbox id="home-default" checked={useDefault} onCheckedChange={(checked) => setUseDefault(checked === true)} />
				<Label htmlFor="home-default">{t("settings.home.useDefault")}</Label>
			</div>

			{useDefault ? null : (
				<div className="flex flex-col gap-3">
					{rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("settings.home.noRows")}</p> : null}
					{rows.map((row, at) => (
						<div key={at} className="flex flex-col gap-3 rounded-md border p-4">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span className="text-sm font-medium">{t("settings.home.row", {number: at + 1})}</span>
								<div className="flex items-center gap-1">
									<Select value={layoutKey(row.columns.map((column) => column.width))} onValueChange={(value) => setLayout(at, LAYOUTS.find((layout) => layoutKey(layout) === value) ?? [12])}>
										<SelectTrigger aria-label={t("settings.home.layout")} className="w-32">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{LAYOUTS.map((layout) => (
												<SelectItem key={layoutKey(layout)} value={layoutKey(layout)}>
													<span dir="ltr">{layout.join(" + ")}</span>
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Button type="button" variant="ghost" size="icon" aria-label={t("settings.home.moveUp")} disabled={at === 0} onClick={() => move(at, -1)}>
										<ArrowUp aria-hidden="true" />
									</Button>
									<Button type="button" variant="ghost" size="icon" aria-label={t("settings.home.moveDown")} disabled={at === rows.length - 1} onClick={() => move(at, 1)}>
										<ArrowDown aria-hidden="true" />
									</Button>
									<Button type="button" variant="ghost" size="icon" aria-label={t("settings.home.removeRow", {number: at + 1})} onClick={() => setRows((current) => current.filter((_, index) => index !== at))}>
										<Trash2 aria-hidden="true" />
									</Button>
								</div>
							</div>
							<div className="grid gap-3 sm:grid-cols-2">
								{row.columns.map((column, columnAt) => (
									<Select key={columnAt} value={column.widget === "" ? NONE : column.widget} onValueChange={(value) => setWidget(at, columnAt, value === NONE ? "" : (value as WidgetKey))}>
										<SelectTrigger aria-label={t("settings.home.widget")} className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={NONE}>{t("settings.home.nothing")}</SelectItem>
											{WIDGET_KEYS.map((key) => (
												<SelectItem key={key} value={key} disabled={used.has(key) && column.widget !== key}>
													{t(`settings.home.widgets.${key}`)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								))}
							</div>
						</div>
					))}
					<div>
						<Button type="button" variant="outline" size="sm" onClick={addRow}>
							<Plus aria-hidden="true" />
							{t("settings.home.addRow")}
						</Button>
					</div>
				</div>
			)}

			{problem ? (
				<Alert variant="destructive">
					<AlertDescription>{problem}</AlertDescription>
				</Alert>
			) : null}
			{notice ? (
				<Alert>
					<AlertDescription>{notice}</AlertDescription>
				</Alert>
			) : null}
			<div>
				<Button type="button" disabled={save.isPending} onClick={submit}>
					{save.isPending ? t("settings.home.saving") : t("settings.home.save")}
				</Button>
			</div>
		</section>
	)
}

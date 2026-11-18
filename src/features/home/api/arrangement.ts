import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

/** The pieces the user can put on the home page. */
export type WidgetKey = "BalanceChart" | "Notes" | "RecentEvents"

export const WIDGET_KEYS: readonly WidgetKey[] = ["BalanceChart", "Notes", "RecentEvents"]
export const isWidgetKey = (value: string): value is WidgetKey => (WIDGET_KEYS as readonly string[]).includes(value)

/** The bank lays rows out on a twelve-column grid: a row is one or two columns whose widths add up to twelve. */
export interface ArrangementColumn {
	index: number
	/** Width in twelfths. */
	width: number
	/** Empty when nothing is placed there yet. */
	widget: WidgetKey | ""
}

export interface ArrangementRow {
	index: number
	columns: ArrangementColumn[]
}

export interface Arrangement {
	rows: ArrangementRow[]
	/** True while the user has not made a layout of their own: the home page shows its standard arrangement. */
	useDefault: boolean
}

const schema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	showDefaultSetting: z.boolean().nullish(),
	rows: z
		.array(
			z.object({
				index: z.number(),
				columns: z.array(z.object({index: z.number(), colMD: z.number(), widget: z.string().nullish()})).nullish(),
			}),
		)
		.nullish(),
})

/** How the user arranged the home page. */
export const getArrangement = async (): Promise<Arrangement> => {
	const data = schema.parse(camelKeys(await apiClient<unknown>("/MainPageArrangement/GetUserArrangements")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "arrangement failed")
	return {
		useDefault: data.showDefaultSetting !== false,
		rows: (data.rows ?? [])
			.map((row) => ({
				index: row.index,
				columns: (row.columns ?? [])
					.map((column) => ({index: column.index, width: column.colMD, widget: isWidgetKey(column.widget ?? "") ? (column.widget as WidgetKey) : ("" as const)}))
					.sort((a, b) => a.index - b.index),
			}))
			.sort((a, b) => a.index - b.index),
	}
}

const answerSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish()})

/** Saves the layout. Sending the same layout again is harmless: the bank replaces the old one. */
export const saveArrangement = async (arrangement: Arrangement): Promise<void> => {
	const data = answerSchema.parse(
		camelKeys(
			await apiClient<unknown>("/MainPageArrangement/SetUserArrangements", {
				method: "POST",
				body: JSON.stringify({
					showDefaultSetting: arrangement.useDefault,
					rows: arrangement.rows.map((row, rowIndex) => ({index: rowIndex, columns: row.columns.map((column, columnIndex) => ({index: columnIndex, colMD: column.width, widget: column.widget}))})),
				}),
			}),
		),
	)
	if (data.isSuccessful === false) throw new Error(data.message ?? "arrangement not saved")
}

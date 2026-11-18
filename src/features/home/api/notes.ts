import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const text = z.string().nullish()

const dateSchema = z.object({isSuccessful: z.boolean().nullish(), message: text, year: z.number().nullish(), month: z.number().nullish(), day: z.number().nullish()})

/** Today's year and month in the calendar of the UI language (Persian or Gregorian), as the notes calendar counts them. */
export const getCurrentMonth = async (): Promise<{year: number; month: number}> => {
	const data = dateSchema.parse(camelKeys(await apiClient<unknown>("/DateTime/GetCurrentCulturedDate")))
	if (data.isSuccessful === false || !data.year || !data.month) throw new Error(data.message ?? "date failed")
	return {year: data.year, month: data.month}
}

const countSchema = z.object({isSuccessful: z.boolean().nullish(), message: text, result: z.union([z.string(), z.number()]).nullish()})

/** How many notes a day may hold. */
export const getMaxNoteCount = async (): Promise<number> => {
	const data = countSchema.parse(camelKeys(await apiClient<unknown>("/Note/GetMaxNoteCount")))
	const value = Number(data.result)
	return data.isSuccessful === false || !Number.isFinite(value) || value < 1 ? 1 : value
}

const monthSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: text,
	dayCount: z.number().nullish(),
	startDay: z.number().nullish(),
	gregorianMonthYear: text,
	hijriMonthYear: text,
	solarMonthYear: text,
	todayYear: z.number().nullish(),
	todayMonth: z.number().nullish(),
	todayDay: z.number().nullish(),
	days: z
		.array(
			z.object({
				isToday: z.boolean().nullish(),
				isHoliday: z.boolean().nullish(),
				events: z.array(z.string()).nullish(),
				notes: z.array(z.object({id: z.number(), title: text})).nullish(),
				solarDay: z.number().nullish(),
				gregorianDay: z.number().nullish(),
				hijriDay: z.number().nullish(),
				solarMonth: text,
				gregorianMonth: text,
				hijriMonth: text,
			}),
		)
		.nullish(),
})

export interface NoteItem {
	id: number
	title: string
}

export interface CalendarDay {
	/** 1-based day of the month shown. */
	number: number
	isToday: boolean
	isHoliday: boolean
	events: string[]
	notes: NoteItem[]
	/** The same day in the other calendars, for the day's detail line. */
	other: string
}

export interface CalendarMonth {
	/** 1 is Saturday, 2 Sunday, … 7 Friday. */
	startDay: number
	days: CalendarDay[]
	/** The month's name(s) and year(s), in the calendars the bank shows. */
	titles: string[]
}

/** One month of the calendar with the user's notes on each day. */
export const getCalendarMonth = async (year: number, month: number): Promise<CalendarMonth> => {
	const data = monthSchema.parse(camelKeys(await apiClient<unknown>(`/Note/GetCalendarMonthDetails?year=${year}&month=${month}`)))
	if (data.isSuccessful === false) throw new Error(data.message ?? "calendar failed")
	return {
		startDay: data.startDay ?? 1,
		titles: [data.solarMonthYear, data.gregorianMonthYear, data.hijriMonthYear].filter((value): value is string => !!value),
		days: (data.days ?? []).map((day, index) => ({
			number: index + 1,
			isToday: day.isToday === true,
			isHoliday: day.isHoliday === true,
			events: day.events ?? [],
			notes: (day.notes ?? []).map((note) => ({id: note.id, title: note.title ?? ""})),
			other: [day.gregorianDay && day.gregorianMonth ? `${day.gregorianDay} ${day.gregorianMonth}` : "", day.solarDay && day.solarMonth ? `${day.solarDay} ${day.solarMonth}` : "", day.hijriDay && day.hijriMonth ? `${day.hijriDay} ${day.hijriMonth}` : ""].filter(Boolean).join(" · "),
		})),
	}
}

const answerSchema = z.object({isSuccessful: z.boolean().nullish(), message: text})

const post = async (path: string, body: unknown): Promise<void> => {
	const data = answerSchema.parse(camelKeys(await apiClient<unknown>(path, {method: "POST", body: JSON.stringify(body)})))
	if (data.isSuccessful === false) throw new Error(data.message ?? "note failed")
}

/** Adds a note to a day. A real change: send once, never retry. */
export const addNote = (title: string, year: number, month: number, day: number): Promise<void> => post("/Note/AddNote", {title, year, month, day})

export const editNote = (noteId: number, newTitle: string): Promise<void> => post("/Note/EditNote", {noteId, newTitle})

export const deleteNote = (noteId: number): Promise<void> => post("/Note/DeleteNote", {noteId})

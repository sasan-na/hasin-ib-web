import {useTranslation} from "react-i18next"

import type {BalanceDay} from "@/features/report/api/balance"
import {formatAmount} from "@/lib/format"
import {formatJalali} from "@/lib/jalali"

const WIDTH = 640
const HEIGHT = 280
const PAD = {top: 16, right: 16, bottom: 32, left: 72}
const GRID = 4

interface Props {
	days: BalanceDay[]
	persian: boolean
}

/** A day written for the axis: in the Persian calendar for Persian, otherwise month and day. */
const label = (iso: string, persian: boolean): string => {
	const date = new Date(`${iso}T12:00:00`)
	return persian ? formatJalali(date).slice(5) : `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`
}

/** The balance of an account day by day, as a line. Each point carries its day's figures as a tooltip. */
export function BalanceChart({days, persian}: Props) {
	const {t, i18n} = useTranslation()
	if (days.length === 0) return null

	const balances = days.map((day) => day.balance)
	const min = Math.min(...balances)
	const max = Math.max(...balances)
	// A flat balance still needs a range to be drawn in.
	const low = min === max ? min - 1 : min
	const high = min === max ? max + 1 : max
	const innerWidth = WIDTH - PAD.left - PAD.right
	const innerHeight = HEIGHT - PAD.top - PAD.bottom
	const x = (index: number): number => PAD.left + (days.length === 1 ? innerWidth / 2 : (index / (days.length - 1)) * innerWidth)
	const y = (value: number): number => PAD.top + (1 - (value - low) / (high - low)) * innerHeight
	const points = days.map((day, index) => `${x(index).toFixed(1)},${y(day.balance).toFixed(1)}`).join(" ")
	// With a long span every point would crowd the line: show the dots only when there are few.
	const showDots = days.length <= 45
	const ticks = Array.from({length: GRID + 1}, (_, index) => low + ((high - low) * index) / GRID)
	const labelAt = [0, Math.floor((days.length - 1) / 2), days.length - 1].filter((value, index, all) => all.indexOf(value) === index)
	const money = (value: number): string => formatAmount(Math.round(value), i18n.language)

	// Time runs left to right in the chart whatever the page's direction.
	return (
		<div dir="ltr">
		<svg role="img" aria-label={t("report.balance.chartLabel", {from: label(days[0].date, persian), to: label(days[days.length - 1].date, persian)})} viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`} className="h-auto w-full">
			{ticks.map((tick) => (
				<g key={tick}>
					<line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} stroke="currentColor" strokeOpacity={0.12} />
					<text x={PAD.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-xs">
						{money(tick)}
					</text>
				</g>
			))}
			{labelAt.map((index) => (
				<text key={index} x={x(index)} y={HEIGHT - 10} textAnchor="middle" className="fill-muted-foreground text-xs">
					{label(days[index].date, persian)}
				</text>
			))}
			<polyline points={points} fill="none" stroke="var(--chart-2)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
			{showDots
				? days.map((day, index) => (
						<circle key={day.date} cx={x(index)} cy={y(day.balance)} r={3} fill="var(--chart-2)">
							<title>{`${label(day.date, persian)} · ${t("report.balance.balance")}: ${money(day.balance)} · ${t("report.balance.deposits")}: ${money(day.deposit)} · ${t("report.balance.withdrawals")}: ${money(day.withdrawal)}`}</title>
						</circle>
					))
				: null}
		</svg>
		</div>
	)
}

import { useMutation, useQuery } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { routeMap } from "@/app/routes"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { getJuniorInstallments } from "@/features/loan/api/junior"
import {
	juniorCitiesOptions,
	juniorTableOptions,
} from "@/features/loan/api/loan.queries"
import { formatAmount } from "@/lib/format"
import { todayJalali } from "@/lib/jalali"

const WAIT_YEARS = Array.from({ length: 11 }, (_, index) => index + 5)
const YEAR_SPAN = 20

/** The bank writes amounts as text; show digits grouped in the user's language and anything else as written. */
const useShow = () => {
	const { i18n } = useTranslation()
	return (value: string): string => {
		const cleaned = value.replace(/,/g, "")
		return cleaned !== "" && /^-?\d+$/.test(cleaned)
			? formatAmount(Number(cleaned), i18n.language)
			: value
	}
}

/** The youth housing deposit: its table for a year of opening, and what to pay in to wait a number of years for the facility. */
export default function LoanJuniorPage() {
	const { t, i18n } = useTranslation()
	const show = useShow()
	const currentYear = Number(todayJalali().slice(0, 4))
	const years = Array.from(
		{ length: YEAR_SPAN * 2 + 1 },
		(_, index) => currentYear - YEAR_SPAN + index,
	)
	const [year, setYear] = useState(currentYear)
	const [cityId, setCityId] = useState("")
	const [waitYears, setWaitYears] = useState("5")
	const [error, setError] = useState("")

	const table = useQuery(juniorTableOptions(year))
	const cities = useQuery(juniorCitiesOptions())
	const calculation = useMutation({ mutationFn: getJuniorInstallments })
	const result = calculation.data
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft
	const cityValue =
		cityId !== "" ? cityId : cities.data?.[0] ? String(cities.data[0].id) : ""

	const submit = (): void => {
		if (cityValue === "") return setError(t("loan.junior.error.city"))
		setError("")
		calculation.mutate({
			year,
			cityType: Number(cityValue),
			waitYears: Number(waitYears),
		})
	}

	const columns: { key: string; label: string }[] = [
		{ key: "paymentYear", label: t("loan.junior.paymentYear") },
		{ key: "leastPay", label: t("loan.junior.leastPay") },
		{ key: "finalRemain", label: t("loan.junior.finalRemain") },
		{ key: "finalBody", label: t("loan.junior.finalBody") },
		{ key: "yearBody", label: t("loan.junior.yearBody") },
		{ key: "averageBody", label: t("loan.junior.averageBody") },
		{ key: "leastFacility", label: t("loan.junior.leastFacility") },
		{
			key: "tehranMax",
			label: `${t("loan.junior.tehran")}: ${t("loan.junior.maxFacility")}`,
		},
		{
			key: "tehranCoefficient",
			label: `${t("loan.junior.tehran")}: ${t("loan.junior.coefficient")}`,
		},
		{
			key: "bigCityMax",
			label: `${t("loan.junior.bigCities")}: ${t("loan.junior.maxFacility")}`,
		},
		{
			key: "bigCityCoefficient",
			label: `${t("loan.junior.bigCities")}: ${t("loan.junior.coefficient")}`,
		},
		{
			key: "otherCityMax",
			label: `${t("loan.junior.otherCities")}: ${t("loan.junior.maxFacility")}`,
		},
		{
			key: "otherCityCoefficient",
			label: `${t("loan.junior.otherCities")}: ${t("loan.junior.coefficient")}`,
		},
	]

	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("loan.junior.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.loan.path}>
						<BackIcon aria-hidden="true" />
						{t("loan.interest.back")}
					</Link>
				</Button>
			</div>
			<p className="text-muted-foreground text-sm">{t("loan.junior.hint")}</p>

			<section
				className="bg-card flex flex-col gap-4 rounded-lg border p-5"
				aria-labelledby="junior-table"
			>
				<div className="flex flex-wrap items-end justify-between gap-3">
					<h2 id="junior-table" className="text-base font-semibold">
						{t("loan.junior.table")}
					</h2>
					<div className="flex flex-col gap-2">
						<Label htmlFor="junior-year">{t("loan.junior.openYear")}</Label>
						<Select
							value={String(year)}
							onValueChange={(value) => {
								setYear(Number(value))
								calculation.reset()
							}}
						>
							<SelectTrigger id="junior-year" className="w-32">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{years.map((item) => (
									<SelectItem key={item} value={String(item)}>
										{formatAmount(item, i18n.language).replace(/[,٬]/g, "")}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				{table.isPending ? (
					<Skeleton className="h-40 w-full" />
				) : table.isError ? (
					<p role="alert" className="text-destructive text-sm">
						{table.error.message || t("loan.junior.loadError")}
					</p>
				) : table.data.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("loan.junior.empty")}
					</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full min-w-max border-collapse text-sm">
							<thead>
								<tr className="border-b text-start">
									{columns.map((column) => (
										<th
											key={column.key}
											className="text-muted-foreground p-2 text-start align-bottom font-medium"
										>
											{column.label}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{table.data.map((row, index) => (
									<tr key={index} className="border-b last:border-0">
										{columns.map((column) => (
											<td key={column.key} className="p-2 tabular-nums">
												{show(row[column.key as keyof typeof row])}
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
				<ul className="text-muted-foreground list-disc ps-5 text-sm">
					{[1, 2, 3, 4, 5].map((n) => (
						<li key={n}>{t(`loan.junior.note${n as 1 | 2 | 3 | 4 | 5}`)}</li>
					))}
				</ul>
			</section>

			<form
				className="bg-card flex flex-col gap-4 rounded-lg border p-5"
				noValidate
				onSubmit={(event) => {
					event.preventDefault()
					submit()
				}}
			>
				<h2 className="text-base font-semibold">
					{t("loan.junior.approximate")}
				</h2>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="flex flex-col gap-2">
						<Label htmlFor="junior-city">{t("loan.junior.cityType")}</Label>
						{cities.isPending ? (
							<Skeleton className="h-9 w-full" />
						) : (
							<Select value={cityValue} onValueChange={setCityId}>
								<SelectTrigger id="junior-city" className="w-full">
									<SelectValue placeholder={t("loan.junior.chooseCity")} />
								</SelectTrigger>
								<SelectContent>
									{(cities.data ?? []).map((city) => (
										<SelectItem key={city.id} value={String(city.id)}>
											{city.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="junior-wait">{t("loan.junior.waitTime")}</Label>
						<Select value={waitYears} onValueChange={setWaitYears}>
							<SelectTrigger id="junior-wait" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{WAIT_YEARS.map((item) => (
									<SelectItem key={item} value={String(item)}>
										{t("loan.junior.years", {
											value: formatAmount(item, i18n.language),
										})}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
				{error ? (
					<p role="alert" className="text-destructive text-sm">
						{error}
					</p>
				) : null}
				<div>
					<Button
						type="submit"
						disabled={calculation.isPending || cities.isPending}
					>
						{calculation.isPending
							? t("loan.interest.calculating")
							: t("loan.interest.calculate")}
					</Button>
				</div>
			</form>

			{calculation.isError ? (
				<Alert variant="destructive">
					<AlertDescription>
						{calculation.error.message || t("loan.interest.failed")}
					</AlertDescription>
				</Alert>
			) : null}

			{result ? (
				<section
					aria-labelledby="junior-result"
					className="bg-card flex flex-col gap-4 rounded-lg border p-5"
				>
					<h2 id="junior-result" className="text-base font-semibold">
						{t("loan.interest.result")}
					</h2>
					<dl className="grid gap-3 sm:grid-cols-2">
						<div className="flex flex-col">
							<dt className="text-muted-foreground text-sm">
								{t("loan.junior.facility")}
							</dt>
							<dd className="text-lg font-bold">
								{show(result.facility)} {t("loan.rial")}
							</dd>
						</div>
						<div className="flex flex-col">
							<dt className="text-muted-foreground text-sm">
								{t("loan.junior.lumpSum")}
							</dt>
							<dd className="text-lg font-bold">
								{show(result.lumpSum)} {t("loan.rial")}
							</dd>
						</div>
					</dl>
					{result.rows.length > 0 ? (
						<div className="overflow-x-auto">
							<table className="w-full border-collapse text-sm">
								<thead>
									<tr className="border-b">
										<th className="text-muted-foreground p-2 text-start font-medium">
											{t("loan.junior.year")}
										</th>
										<th className="text-muted-foreground p-2 text-start font-medium">
											{t("loan.junior.monthly")}
										</th>
										<th className="text-muted-foreground p-2 text-start font-medium">
											{t("loan.junior.annual")}
										</th>
									</tr>
								</thead>
								<tbody>
									{result.rows.map((row, index) => (
										<tr key={index} className="border-b last:border-0">
											<td className="p-2 tabular-nums">{row.year}</td>
											<td className="p-2 tabular-nums">{show(row.monthly)}</td>
											<td className="p-2 tabular-nums">{show(row.annual)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : null}
					<dl className="flex flex-col gap-2 text-sm">
						<div>
							<dt className="font-medium">{t("loan.junior.lumpSumTitle")}</dt>
							<dd className="text-muted-foreground">
								{t("loan.junior.lumpSumNote")}
							</dd>
						</div>
						<div>
							<dt className="font-medium">{t("loan.junior.monthlyTitle")}</dt>
							<dd className="text-muted-foreground">
								{t("loan.junior.monthlyNote")}
							</dd>
						</div>
						<div>
							<dt className="font-medium">{t("loan.junior.annualTitle")}</dt>
							<dd className="text-muted-foreground">
								{t("loan.junior.annualNote")}
							</dd>
						</div>
					</dl>
				</section>
			) : null}
		</div>
	)
}

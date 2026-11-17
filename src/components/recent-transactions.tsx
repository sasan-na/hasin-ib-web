import {useQuery} from "@tanstack/react-query"
import {useTranslation} from "react-i18next"

import {Badge} from "@/components/ui/badge"
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card"
import {Skeleton} from "@/components/ui/skeleton"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table"
import {recentTransactionsOptions} from "@/lib/api/home.queries"
import {cn} from "@/lib/utils"

// The server's status codes: 0 done, 1 in progress, 2 failed, 3 needs reversing.
const STATUS_STYLES: Record<number, string> = {
	0: "border-transparent bg-success/15 text-success",
	1: "border-transparent bg-info/15 text-info",
	2: "border-transparent bg-destructive/15 text-destructive",
	3: "border-transparent bg-warning/15 text-warning",
}

/** The user's latest transactions with their outcome. */
export function RecentTransactions() {
	const {t, i18n} = useTranslation()
	const query = useQuery(recentTransactionsOptions(i18n.language))

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">{t("home.recentTransactions.title")}</CardTitle>
			</CardHeader>
			<CardContent>
				{query.isPending ? (
					<div className="flex flex-col gap-2" aria-hidden="true">
						<Skeleton className="h-8 w-full" />
						<Skeleton className="h-8 w-full" />
						<Skeleton className="h-8 w-full" />
					</div>
				) : query.isError ? (
					<p role="alert" className="text-sm text-destructive">
						{t("home.recentTransactions.error")}
					</p>
				) : query.data.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t("home.recentTransactions.empty")}</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("home.recentTransactions.type")}</TableHead>
								<TableHead>{t("home.recentTransactions.dateTime")}</TableHead>
								<TableHead>{t("home.recentTransactions.status")}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{query.data.map((transaction, index) => (
								// The server sends no id for these rows; the list is short and never reordered client-side.
								<TableRow key={index}>
									<TableCell className="font-medium whitespace-normal">{transaction.type}</TableCell>
									{/* Dates read left-to-right in both languages, as in the legacy app. */}
									<TableCell dir="ltr" className="text-start whitespace-nowrap">
										{transaction.date} {transaction.time}
									</TableCell>
									<TableCell>
										<Badge variant="outline" className={cn(STATUS_STYLES[transaction.status] ?? STATUS_STYLES[3])}>
											{transaction.statusTitle}
										</Badge>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	)
}

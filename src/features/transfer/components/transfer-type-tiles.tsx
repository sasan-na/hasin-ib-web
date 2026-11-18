import {ArrowLeftRight, CalendarClock, ChevronRight, CreditCard, Landmark, Users, Zap, type LucideIcon} from "lucide-react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {TONES} from "@/features/menu/components/service-cards"
import {cn} from "@/lib/utils"

/** The kinds of transfer one form serves: the form below rearranges itself for the one chosen. */
export type TransferType = "account" | "card" | "satna" | "paya"

export const TRANSFER_TYPES: readonly TransferType[] = ["account", "card", "satna", "paya"]

const tileClass =
	"group flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-start shadow-card transition-shadow hover:shadow-card-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"

interface TileBodyProps {
	icon: LucideIcon
	badge: string
	name: string
	hint: string
}

function TileBody({icon: Icon, badge, name, hint}: TileBodyProps) {
	return (
		<>
			<span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", badge)}>
				<Icon className="size-5" />
			</span>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="truncate text-sm font-semibold">{name}</span>
				<span className="line-clamp-2 text-xs text-muted-foreground">{hint}</span>
			</span>
			<ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
		</>
	)
}

interface TransferTypeTilesProps {
	value: TransferType
	onChange: (type: TransferType) => void
}

/** Pick what to transfer: the form below follows. Group and standing orders have their own pages, so they are links. */
export function TransferTypeTiles({value, onChange}: TransferTypeTilesProps) {
	const {t} = useTranslation()

	const types: Record<TransferType, TileBodyProps> = {
		account: {icon: ArrowLeftRight, badge: TONES.info.badge, name: t("transfer.type.account"), hint: t("transfer.type.accountHint")},
		card: {icon: CreditCard, badge: TONES.info.badge, name: t("transfer.type.card"), hint: t("transfer.type.cardHint")},
		satna: {icon: Zap, badge: TONES.success.badge, name: t("transfer.iban.satna"), hint: t("transfer.iban.satnaHint")},
		paya: {icon: Landmark, badge: TONES.primary.badge, name: t("transfer.iban.paya"), hint: t("transfer.iban.payaHint")},
	}

	return (
		<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{TRANSFER_TYPES.map((type) => (
				<li key={type}>
					<button
						type="button"
						aria-pressed={value === type}
						className={cn(tileClass, value === type && "border-primary bg-primary-soft ring-2 ring-primary/20")}
						onClick={() => onChange(type)}
					>
						<TileBody {...types[type]} />
					</button>
				</li>
			))}
			<li>
				<Link to={routeMap.transferGroup.path} className={tileClass}>
					<TileBody icon={Users} badge={TONES.primary.badge} name={t("transfer.group.title")} hint={t("transfer.type.groupHint")} />
				</Link>
			</li>
			<li>
				<Link to={routeMap.transferStandingOrders.path} className={tileClass}>
					<TileBody icon={CalendarClock} badge={TONES.warning.badge} name={t("transfer.standing.title")} hint={t("transfer.type.standingHint")} />
				</Link>
			</li>
		</ul>
	)
}

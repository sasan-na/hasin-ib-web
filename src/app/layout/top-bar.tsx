import {useQuery} from "@tanstack/react-query"
import {Bell, CircleHelp, Languages, LogOut, Moon, Search, Settings, Sun, UserRound} from "lucide-react"
import {useEffect, useState} from "react"
import {useTranslation} from "react-i18next"
import {Link, NavLink, useNavigate} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {LanguageSwitcher} from "@/components/language-switcher"
import {Logo} from "@/components/logo"
import {ThemeSwitcher} from "@/components/theme-switcher"
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar"
import {Button} from "@/components/ui/button"
import {CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList} from "@/components/ui/command"
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger} from "@/components/ui/dropdown-menu"
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover"
import {SidebarTrigger} from "@/components/ui/sidebar"
import {useSignOut} from "@/features/auth/hooks/use-sign-out"
import {profileOptions} from "@/features/home/api/home.queries"
import {messagesOptions} from "@/features/message/api/message.queries"
import {useIsDarkMode} from "@/hooks/use-is-dark-mode"
import {LANGUAGE_NATIVE_NAMES, SUPPORTED_LANGUAGES, type SupportedLanguage} from "@/lib/i18n"
import {useSession} from "@/store/session"
import {useThemeStore} from "@/store/theme"

const ICON_BUTTON = "size-10 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
const SHOWN_MESSAGES = 5

/** The pages the palette jumps to: the bank's sections, named as the sidebar names them. */
const PAGES = [
	{key: "navigation.home", path: routeMap.home.path},
	{key: "navigation.accounts", path: routeMap.account.path},
	{key: "navigation.cards", path: routeMap.card.path},
	{key: "navigation.transfers", path: routeMap.transfer.path},
	{key: "navigation.cheques", path: routeMap.cheque.path},
	{key: "navigation.digitalCheques", path: routeMap.digitalCheque.path},
	{key: "navigation.loans", path: routeMap.loan.path},
	{key: "navigation.payments", path: routeMap.payment.path},
	{key: "navigation.reports", path: routeMap.report.path},
	{key: "navigation.messages", path: routeMap.messageList.path},
	{key: "navigation.contacts", path: routeMap.contactList.path},
	{key: "navigation.receipts", path: routeMap.receiptList.path},
	{key: "navigation.dashboard", path: routeMap.dashboardHome.path},
	{key: "navigation.security", path: routeMap.security.path},
	{key: "navigation.other", path: routeMap.other.path},
] as const

/** The bar across the top: menu, one search (Ctrl+K), help, unread messages, the look of the page and the user's menu. */
export function TopBar() {
	const {t, i18n} = useTranslation()
	const navigate = useNavigate()
	const signOut = useSignOut()
	const sessionUsername = useSession((s) => s.username)
	const profile = useQuery(profileOptions())
	const messages = useQuery(messagesOptions())
	const dark = useIsDarkMode()
	const setTheme = useThemeStore((s) => s.setTheme)
	const otherLanguage = SUPPORTED_LANGUAGES.find((language) => language !== (i18n.resolvedLanguage as SupportedLanguage)) ?? SUPPORTED_LANGUAGES[0]
	const [open, setOpen] = useState(false)
	const [phrase, setPhrase] = useState("")

	const unreadMessages = (messages.data ?? []).filter((message) => message.isUnread)
	const unread = unreadMessages.reduce((sum, message) => sum + Math.max(1, message.unreadCount), 0)
	const name = profile.data?.fullName?.trim() || profile.data?.username || sessionUsername || ""

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault()
				setOpen((value) => !value)
			}
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [])

	const go = (path: string) => {
		setOpen(false)
		setPhrase("")
		void navigate(path)
	}
	const trimmed = phrase.trim()

	return (
		<header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl">
			<div className="grid h-[4.5rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6 lg:px-8">
				<div className="flex items-center gap-2">
					<SidebarTrigger className="size-10 rounded-xl border bg-card text-muted-foreground shadow-none hover:bg-muted hover:text-foreground" />
					<NavLink to={routeMap.home.path} aria-label={t("appName")} className="flex items-center gap-2 fill-primary md:hidden">
						<Logo size={22} className="fill-inherit" />
					</NavLink>
				</div>

				<div className="flex justify-center">
					<button
						type="button"
						onClick={() => setOpen(true)}
						className="hidden h-11 w-full max-w-md items-center gap-3 rounded-xl border bg-card px-4 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
					>
						<Search aria-hidden="true" className="size-4 shrink-0" />
						<span className="min-w-0 flex-1 truncate text-start">{t("header.searchPlaceholder")}</span>
						<kbd dir="ltr" className="rounded-md border bg-muted px-1.5 py-0.5 font-sans text-[11px]">
							Ctrl K
						</kbd>
					</button>
				</div>

				<div className="flex items-center gap-1">
					<Button variant="ghost" size="icon" aria-label={t("header.search")} onClick={() => setOpen(true)} className={`${ICON_BUTTON} sm:hidden`}>
						<Search className="size-5" />
					</Button>

					<Button variant="ghost" size="icon" asChild className={`${ICON_BUTTON} hidden sm:inline-flex`}>
						<NavLink to={routeMap.other.path} aria-label={t("header.help")} title={t("header.help")}>
							<CircleHelp className="size-5" />
						</NavLink>
					</Button>

					<Popover>
						<PopoverTrigger asChild>
							<Button variant="ghost" size="icon" aria-label={unread > 0 ? t("header.notificationsUnread", {count: unread}) : t("header.notifications")} className={`${ICON_BUTTON} relative`}>
								<Bell className="size-5" />
								{unread > 0 ? (
									<span className="absolute end-1 top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground ring-2 ring-background">
										{unread > 9 ? "9+" : unread}
									</span>
								) : null}
							</Button>
						</PopoverTrigger>
						<PopoverContent align="end" className="w-80 p-0">
							<div className="flex items-center justify-between border-b px-4 py-3">
								<p className="text-sm font-semibold">{t("header.notifications")}</p>
								<Link to={routeMap.messageList.path} className="text-xs font-medium text-brand hover:underline">
									{t("header.allMessages")}
								</Link>
							</div>
							{messages.isError ? (
								<p role="alert" className="px-4 py-6 text-sm text-destructive">
									{t("header.notificationsError")}
								</p>
							) : unreadMessages.length === 0 ? (
								<p className="px-4 py-6 text-sm text-muted-foreground">{t("header.noNotifications")}</p>
							) : (
								<ul className="max-h-80 overflow-y-auto">
									{unreadMessages.slice(0, SHOWN_MESSAGES).map((message) => (
										<li key={message.id} className="border-b last:border-0">
											<Link to={routeMap.messageList.path} className="flex gap-3 px-4 py-3 hover:bg-muted/60">
												<span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
												<span className="min-w-0">
													<span className="block truncate text-sm font-medium">{message.subject}</span>
													<span className="mt-0.5 block truncate text-xs text-muted-foreground">{message.department}</span>
													<span className="mt-1 block text-[11px] text-muted-foreground">{message.date}</span>
												</span>
											</Link>
										</li>
									))}
								</ul>
							)}
						</PopoverContent>
					</Popover>

					<ThemeSwitcher className={`${ICON_BUTTON} hidden sm:inline-flex`} />
					<LanguageSwitcher className="hidden sm:inline-flex" />

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								aria-label={t("header.profileMenu")}
								className="ms-1 flex items-center gap-2 rounded-xl p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<Avatar className="size-9">
									{profile.data?.image ? <AvatarImage src={profile.data.image} alt="" /> : null}
									<AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
								</Avatar>
								<span className="hidden max-w-32 truncate text-sm font-semibold lg:block" dir="auto">
									{name}
								</span>
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							<DropdownMenuLabel className="font-normal">
								<p className="truncate text-sm font-semibold" dir="auto">
									{name}
								</p>
							</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link to={routeMap.profile.path}>
									<UserRound />
									{t("profile.title")}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link to={routeMap.settings.path}>
									<Settings />
									{t("settings.title")}
								</Link>
							</DropdownMenuItem>
							{/* On a phone the theme and language buttons leave the bar, so they live here. */}
							<DropdownMenuItem className="sm:hidden" onSelect={() => setTheme(dark ? "light" : "dark")}>
								{dark ? <Sun /> : <Moon />}
								{t(dark ? "theme.light" : "theme.dark")}
							</DropdownMenuItem>
							<DropdownMenuItem className="sm:hidden" lang={otherLanguage} onSelect={() => void i18n.changeLanguage(otherLanguage)}>
								<Languages />
								{LANGUAGE_NATIVE_NAMES[otherLanguage]}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onSelect={() => void signOut()} className="text-destructive focus:text-destructive">
								<LogOut className="rtl:-scale-x-100" />
								{t("auth.signOut")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			<CommandDialog open={open} onOpenChange={setOpen} title={t("header.search")} description={t("header.searchPlaceholder")}>
				<CommandInput value={phrase} onValueChange={setPhrase} placeholder={t("header.searchPlaceholder")} />
				<CommandList>
					<CommandEmpty>{t("header.noResults")}</CommandEmpty>
					{trimmed !== "" ? (
						<CommandGroup heading={t("header.searchFor")}>
							<CommandItem value={`search ${trimmed}`} onSelect={() => go(`${routeMap.search.path}?phrase=${encodeURIComponent(trimmed)}`)}>
								<Search />
								{t("header.searchPhrase", {phrase: trimmed})}
							</CommandItem>
						</CommandGroup>
					) : null}
					<CommandGroup heading={t("header.pages")}>
						{PAGES.map((page) => (
							<CommandItem key={page.path} value={t(page.key)} onSelect={() => go(page.path)}>
								{t(page.key)}
							</CommandItem>
						))}
					</CommandGroup>
				</CommandList>
			</CommandDialog>
		</header>
	)
}

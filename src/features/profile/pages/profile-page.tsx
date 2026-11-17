import {useQuery} from "@tanstack/react-query"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Skeleton} from "@/components/ui/skeleton"
import {getProfile, type ProfileField} from "@/features/profile/api/profile"

/** Who the user is to the bank: name, codes and contact details, and the way they sign in. */
export default function ProfilePage() {
	const {t} = useTranslation()
	const profile = useQuery({queryKey: ["profile"], queryFn: getProfile, staleTime: 5 * 60_000, retry: false})

	const label = (field: ProfileField): string => t(`profile.fields.${field.key as "customerCode"}`, {defaultValue: field.key})

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("profile.title")}</h1>

			{profile.isPending ? (
				<Skeleton className="h-64 w-full" />
			) : profile.isError ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{profile.error.message || t("profile.error")}
				</p>
			) : (
				<>
					<section className="flex flex-col gap-4 rounded-lg border bg-card p-5" aria-labelledby="profile-general">
						<h2 id="profile-general" className="text-base font-semibold">
							{profile.data.title || t("profile.general")}
						</h2>
						<dl className="grid gap-3 sm:grid-cols-2">
							{profile.data.fields.map((field) => (
								<div key={field.key} className={field.key === "address" ? "flex flex-col sm:col-span-2" : "flex flex-col"}>
									<dt className="text-sm text-muted-foreground">{label(field)}</dt>
									<dd dir={field.ltr ? "ltr" : undefined} className="text-start font-medium wrap-break-word">
										{field.value}
									</dd>
								</div>
							))}
						</dl>
					</section>

					<div>
						<Button asChild variant="outline">
							<Link to={routeMap.mobileBanking.path}>{t("profile.mobile.open")}</Link>
						</Button>
					</div>
					<section className="flex flex-col gap-4 rounded-lg border bg-card p-5" aria-labelledby="profile-signin">
						<h2 id="profile-signin" className="text-base font-semibold">
							{t("profile.signIn")}
						</h2>
						<dl className="grid gap-3 sm:grid-cols-2">
							<div className="flex flex-col">
								<dt className="text-sm text-muted-foreground">{t("profile.fields.username")}</dt>
								<dd dir="ltr" className="text-start font-medium">
									{profile.data.username}
								</dd>
							</div>
							<div className="flex flex-col">
								<dt className="text-sm text-muted-foreground">{t("profile.fields.password")}</dt>
								<dd className="font-medium">{profile.data.hasOtp ? t("profile.oneTimeCode") : "••••••••"}</dd>
							</div>
						</dl>
						<div className="flex flex-wrap gap-2">
							<Button asChild variant="outline" size="sm">
								<Link to={routeMap.changeUsername.path}>{t("profile.username.title")}</Link>
							</Button>
							{!profile.data.hasOtp ? (
								<Button asChild variant="outline" size="sm">
									<Link to={routeMap.changePassword.path}>{t("profile.changePassword")}</Link>
								</Button>
							) : null}
						</div>
					</section>
				</>
			)}
		</div>
	)
}

import {Logo} from "@/components/logo.tsx";
import {useTranslation} from "react-i18next";
import {NavLink} from "react-router-dom";

export default function SidebarLogo() {
    const {t} = useTranslation()
    return (
        <div
            className={`flex h-16 items-center px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0`}>
            <NavLink to={"/"}
                     className={`flex w-full items-center gap-2 fill-primary text-black transition-opacity hover:opacity-75 dark:text-white`}>
                <Logo size={22}
                      className={"fill-inherit transition-colors"}/>
                <span className={"min-w-0 group-data-[collapsible=icon]:hidden"}><h1 className={"truncate text-lg font-extrabold leading-5"}> {t("appName")} </h1><span className={"block truncate text-[11px] font-normal text-muted-foreground"}>{t("navigation.tagline")}</span></span>
            </NavLink>
        </div>
    )
}

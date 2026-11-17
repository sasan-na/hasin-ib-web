import {Logo} from "@/components/logo.tsx";
import {useTranslation} from "react-i18next";
import {NavLink} from "react-router-dom";

export default function SidebarLogo() {
    const {t} = useTranslation()
    return (
        <div
            className={`flex h-16 items-center px-4`}>
            <NavLink to={"/"}
                     className={`flex w-full items-center gap-2 fill-primary text-black transition-opacity hover:opacity-75 dark:text-white`}>
                <Logo size={22}
                      className={"fill-inherit transition-colors"}/>
                <h1 className={"text-base font-semibold"}> {t("appName")} </h1>
            </NavLink>
        </div>
    )
}

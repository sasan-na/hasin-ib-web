import React from "react";
import {createBrowserRouter, createRoutesFromElements, Navigate, Route, RouterProvider} from "react-router-dom";
import {AuthShell, PublicShell} from "@/app/layout/shell.tsx";
import useSelectTheme from "@/app/use-select-theme.ts";
import {RequireAuth} from "@/app/guards";
import {routeMap} from "@/app/routes";

const Home = React.lazy(() => import("@/features/home/pages/home-page.tsx"));
const AccountHome = React.lazy(() => import("@/features/account/pages/account-home-page.tsx"));
const Account = React.lazy(() => import("@/features/account/pages/account-list-page.tsx"));
const AccountInfo = React.lazy(() => import("@/features/account/pages/account-info-page.tsx"));
const TransactionResult = React.lazy(() => import("@/features/transaction/pages/transaction-result-page.tsx"));
const AccountNew = React.lazy(() => import("@/features/account/pages/open-account-page.tsx"));
const AccountDelegate = React.lazy(() => import("@/features/account/pages/delegate-request-page.tsx"));
const AccountCredit = React.lazy(() => import("@/features/account/pages/credit-calculate-page.tsx"));
const Login = React.lazy(() => import("@/features/auth/pages/login-page.tsx"));
const ChangePassword = React.lazy(() => import("@/features/auth/pages/change-password-page.tsx"));
const NotFound = React.lazy(() => import("@/app/pages/not-found"));

const router = createBrowserRouter(
    createRoutesFromElements(
        <>
            <Route element={<PublicShell/>}>
                <Route path={routeMap.login.path} element={<Login/>}/>
            </Route>
            <Route element={<RequireAuth/>}>
                <Route element={<PublicShell/>}>
                    <Route path={routeMap.changePassword.path} element={<ChangePassword/>}/>
                </Route>
                <Route element={<AuthShell/>}>
                    <Route path={routeMap.home.path} element={<Home/>} index={true}/>
                    <Route path={routeMap.account.path} element={<AccountHome/>}/>
                    <Route path={routeMap.accountList.path} element={<Account/>}/>
                    <Route path={routeMap.accountInfo.path} element={<AccountInfo/>}/>
                    <Route path={routeMap.transactionResult.path} element={<TransactionResult/>}/>
                    <Route path={routeMap.accountNew.path} element={<AccountNew/>}/>
                    <Route path={routeMap.accountDelegate.path} element={<AccountDelegate/>}/>
                    <Route path={routeMap.accountCreditCalculate.path} element={<AccountCredit/>}/>
                    <Route path={routeMap.notFound.path} element={<NotFound/>}/>
                    <Route path="*" element={<Navigate to={routeMap.notFound.path}/>}/>
                </Route>
            </Route>
        </>
    )
)

export default function Routing() {
    useSelectTheme();
    return <RouterProvider router={router}/>;
}

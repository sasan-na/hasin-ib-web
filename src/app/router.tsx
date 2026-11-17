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
const CardHome = React.lazy(() => import("@/features/card/pages/card-home-page.tsx"));
const CardList = React.lazy(() => import("@/features/card/pages/card-list-page.tsx"));
const CardInfo = React.lazy(() => import("@/features/card/pages/card-info-page.tsx"));
const CardRequestList = React.lazy(() => import("@/features/card/pages/card-request-list-page.tsx"));
const CardAccountList = React.lazy(() => import("@/features/card/pages/card-account-list-page.tsx"));
const CardConnectAccount = React.lazy(() => import("@/features/card/pages/card-connect-account-page.tsx"));
const CardReplicaRenew = React.lazy(() => import("@/features/card/pages/card-replica-renew-page.tsx"));
const CardGift = React.lazy(() => import("@/features/card/pages/card-gift-page.tsx"));
const TransferHome = React.lazy(() => import("@/features/transfer/pages/transfer-home-page.tsx"));
const SmartTransfer = React.lazy(() => import("@/features/transfer/pages/smart-transfer-page.tsx"));
const StandingOrderList = React.lazy(() => import("@/features/transfer/pages/standing-order-list-page.tsx"));
const RegisterStandingOrder = React.lazy(() => import("@/features/transfer/pages/register-standing-order-page.tsx"));
const IbanTransfer = React.lazy(() => import("@/features/transfer/pages/iban-transfer-page.tsx"));
const CardTransfer = React.lazy(() => import("@/features/transfer/pages/card-transfer-page.tsx"));
const GroupTransfer = React.lazy(() => import("@/features/transfer/pages/group-transfer-page.tsx"));
const AccountPassword = React.lazy(() => import("@/features/account/pages/account-password-page.tsx"));
const Statement = React.lazy(() => import("@/features/report/pages/statement-page.tsx"));
const LoanList = React.lazy(() => import("@/features/loan/pages/loan-list-page.tsx"));
const MessageList = React.lazy(() => import("@/features/message/pages/message-list-page.tsx"));
const MessageDetail = React.lazy(() => import("@/features/message/pages/message-detail-page.tsx"));
const NewMessage = React.lazy(() => import("@/features/message/pages/new-message-page.tsx"));
const ContactList = React.lazy(() => import("@/features/contact/pages/contact-list-page.tsx"));
const ContactForm = React.lazy(() => import("@/features/contact/pages/contact-form-page.tsx"));
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
                    <Route path={routeMap.card.path} element={<CardHome/>}/>
                    <Route path={routeMap.cardList.path} element={<CardList/>}/>
                    <Route path={routeMap.cardInfo.path} element={<CardInfo/>}/>
                    <Route path={routeMap.cardRequestList.path} element={<CardRequestList/>}/>
                    <Route path={routeMap.cardAccountList.path} element={<CardAccountList/>}/>
                    <Route path={routeMap.cardConnectAccount.path} element={<CardConnectAccount/>}/>
                    <Route path={routeMap.cardReplicaRenew.path} element={<CardReplicaRenew/>}/>
                    <Route path={routeMap.cardGift.path} element={<CardGift/>}/>
                    <Route path={routeMap.transfer.path} element={<TransferHome/>}/>
                    <Route path={routeMap.transferSmart.path} element={<SmartTransfer/>}/>
                    <Route path={routeMap.transferStandingOrders.path} element={<StandingOrderList/>}/>
                    <Route path={routeMap.transferStandingOrderNew.path} element={<RegisterStandingOrder/>}/>
                    <Route path={routeMap.transferIban.path} element={<IbanTransfer/>}/>
                    <Route path={routeMap.transferCard.path} element={<CardTransfer/>}/>
                    <Route path={routeMap.transferGroup.path} element={<GroupTransfer/>}/>
                    <Route path={routeMap.accountPassword.path} element={<AccountPassword/>}/>
                    <Route path={routeMap.reportStatement.path} element={<Statement/>}/>
                    <Route path={routeMap.loanList.path} element={<LoanList/>}/>
                    <Route path={routeMap.messageList.path} element={<MessageList/>}/>
                    <Route path={routeMap.messageNew.path} element={<NewMessage/>}/>
                    <Route path={routeMap.messageDetail.path} element={<MessageDetail/>}/>
                    <Route path={routeMap.contactList.path} element={<ContactList/>}/>
                    <Route path={routeMap.contactNew.path} element={<ContactForm/>}/>
                    <Route path={routeMap.contactEdit.path} element={<ContactForm/>}/>
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

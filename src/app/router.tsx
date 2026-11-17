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
const CardlessList = React.lazy(() => import("@/features/card/pages/cardless-list-page.tsx"));
const CardlessNew = React.lazy(() => import("@/features/card/pages/cardless-new-page.tsx"));
const TransferHome = React.lazy(() => import("@/features/transfer/pages/transfer-home-page.tsx"));
const SmartTransfer = React.lazy(() => import("@/features/transfer/pages/smart-transfer-page.tsx"));
const StandingOrderList = React.lazy(() => import("@/features/transfer/pages/standing-order-list-page.tsx"));
const RegisterStandingOrder = React.lazy(() => import("@/features/transfer/pages/register-standing-order-page.tsx"));
const IbanTransfer = React.lazy(() => import("@/features/transfer/pages/iban-transfer-page.tsx"));
const CardTransfer = React.lazy(() => import("@/features/transfer/pages/card-transfer-page.tsx"));
const GroupTransfer = React.lazy(() => import("@/features/transfer/pages/group-transfer-page.tsx"));
const AccountPassword = React.lazy(() => import("@/features/account/pages/account-password-page.tsx"));
const ReportHome = React.lazy(() => import("@/features/report/pages/report-home-page.tsx"));
const Statement = React.lazy(() => import("@/features/report/pages/statement-page.tsx"));
const Events = React.lazy(() => import("@/features/report/pages/events-page.tsx"));
const Monthly = React.lazy(() => import("@/features/report/pages/monthly-page.tsx"));
const PeriodicList = React.lazy(() => import("@/features/report/pages/periodic-list-page.tsx"));
const PeriodicForm = React.lazy(() => import("@/features/report/pages/periodic-form-page.tsx"));
const Balance = React.lazy(() => import("@/features/report/pages/balance-page.tsx"));
const LoanInterest = React.lazy(() => import("@/features/loan/pages/loan-interest-page.tsx"));
const LoanJunior = React.lazy(() => import("@/features/loan/pages/loan-junior-page.tsx"));
const SubUsers = React.lazy(() => import("@/features/dashboard/pages/sub-users-page.tsx"));
const WorkflowRules = React.lazy(() => import("@/features/dashboard/pages/workflow-rules-page.tsx"));
const Dashboard = React.lazy(() => import("@/features/dashboard/pages/dashboard-page.tsx"));
const ReceiptList = React.lazy(() => import("@/features/receipt/pages/receipt-list-page.tsx"));
const ReceiptView = React.lazy(() => import("@/features/receipt/pages/receipt-view-page.tsx"));
const OtherLoan = React.lazy(() => import("@/features/loan/pages/other-loan-page.tsx"));
const BatchLoan = React.lazy(() => import("@/features/loan/pages/batch-loan-page.tsx"));
const StandingOrderDetails = React.lazy(() => import("@/features/transfer/pages/standing-order-details-page.tsx"));
const EtcCharge = React.lazy(() => import("@/features/etc/pages/etc-charge-page.tsx"));
const EtcActivate = React.lazy(() => import("@/features/etc/pages/etc-activate-page.tsx"));
const EtcList = React.lazy(() => import("@/features/etc/pages/etc-list-page.tsx"));
const ChequeHome = React.lazy(() => import("@/features/cheque/pages/cheque-home-page.tsx"));
const DashboardHome = React.lazy(() => import("@/features/dashboard/pages/dashboard-home-page.tsx"));
const PaymentHome = React.lazy(() => import("@/features/bill/pages/payment-home-page.tsx"));
const OtherHome = React.lazy(() => import("@/features/menu/pages/other-home-page.tsx"));
const Ussd = React.lazy(() => import("@/features/ussd/pages/ussd-page.tsx"));
const ConnectedCardStatement = React.lazy(() => import("@/features/card/pages/connected-card-statement-page.tsx"));
const ConnectedCards = React.lazy(() => import("@/features/card/pages/connected-card-list-page.tsx"));
const ChangeUsername = React.lazy(() => import("@/features/profile/pages/change-username-page.tsx"));
const MobileBanking = React.lazy(() => import("@/features/profile/pages/mobile-banking-page.tsx"));
const Profile = React.lazy(() => import("@/features/profile/pages/profile-page.tsx"));
const LoanHome = React.lazy(() => import("@/features/loan/pages/loan-home-page.tsx"));
const LoanList = React.lazy(() => import("@/features/loan/pages/loan-list-page.tsx"));
const MessageList = React.lazy(() => import("@/features/message/pages/message-list-page.tsx"));
const MessageDetail = React.lazy(() => import("@/features/message/pages/message-detail-page.tsx"));
const NewMessage = React.lazy(() => import("@/features/message/pages/new-message-page.tsx"));
const ContactList = React.lazy(() => import("@/features/contact/pages/contact-list-page.tsx"));
const ContactForm = React.lazy(() => import("@/features/contact/pages/contact-form-page.tsx"));
const BillList = React.lazy(() => import("@/features/bill/pages/bill-list-page.tsx"));
const PayBill = React.lazy(() => import("@/features/bill/pages/pay-bill-page.tsx"));
const ChequeList = React.lazy(() => import("@/features/cheque/pages/cheque-list-page.tsx"));
const ChequeBook = React.lazy(() => import("@/features/cheque/pages/cheque-book-page.tsx"));
const PichakInquiry = React.lazy(() => import("@/features/cheque/pages/pichak-inquiry-page.tsx"));
const PichakRegister = React.lazy(() => import("@/features/cheque/pages/pichak-register-page.tsx"));
const PichakChain = React.lazy(() => import("@/features/cheque/pages/pichak-chain-page.tsx"));
const PichakOwner = React.lazy(() => import("@/features/cheque/pages/pichak-owner-page.tsx"));
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
                    <Route path={routeMap.cardlessList.path} element={<CardlessList/>}/>
                    <Route path={routeMap.cardlessNew.path} element={<CardlessNew/>}/>
                    <Route path={routeMap.transfer.path} element={<TransferHome/>}/>
                    <Route path={routeMap.transferSmart.path} element={<SmartTransfer/>}/>
                    <Route path={routeMap.transferStandingOrders.path} element={<StandingOrderList/>}/>
                    <Route path={routeMap.transferStandingOrderNew.path} element={<RegisterStandingOrder/>}/>
                    <Route path={routeMap.transferIban.path} element={<IbanTransfer/>}/>
                    <Route path={routeMap.transferCard.path} element={<CardTransfer/>}/>
                    <Route path={routeMap.transferGroup.path} element={<GroupTransfer/>}/>
                    <Route path={routeMap.accountPassword.path} element={<AccountPassword/>}/>
                    <Route path={routeMap.report.path} element={<ReportHome/>}/>
                    <Route path={routeMap.reportStatement.path} element={<Statement/>}/>
                    <Route path={routeMap.reportEvents.path} element={<Events/>}/>
                    <Route path={routeMap.reportMonthly.path} element={<Monthly/>}/>
                    <Route path={routeMap.reportPeriodic.path} element={<PeriodicList/>}/>
                    <Route path={routeMap.reportPeriodicNew.path} element={<PeriodicForm/>}/>
                    <Route path={routeMap.reportPeriodicEdit.path} element={<PeriodicForm/>}/>
                    <Route path={routeMap.reportBalance.path} element={<Balance/>}/>
                    <Route path={routeMap.loan.path} element={<LoanHome/>}/>
                    <Route path={routeMap.profile.path} element={<Profile/>}/>
                    <Route path={routeMap.mobileBanking.path} element={<MobileBanking/>}/>
                    <Route path={routeMap.changeUsername.path} element={<ChangeUsername/>}/>
                    <Route path={routeMap.cardConnected.path} element={<ConnectedCards/>}/>
                    <Route path={routeMap.cardConnectedStatement.path} element={<ConnectedCardStatement/>}/>
                    <Route path={routeMap.cheque.path} element={<ChequeHome/>}/>
                    <Route path={routeMap.dashboardHome.path} element={<DashboardHome/>}/>
                    <Route path={routeMap.payment.path} element={<PaymentHome/>}/>
                    <Route path={routeMap.ussd.path} element={<Ussd/>}/>
                    <Route path={routeMap.other.path} element={<OtherHome/>}/>
                    <Route path={routeMap.loanList.path} element={<LoanList/>}/>
                    <Route path={routeMap.etcList.path} element={<EtcList/>}/>
                    <Route path={routeMap.etcActivate.path} element={<EtcActivate/>}/>
                    <Route path={routeMap.etcCharge.path} element={<EtcCharge/>}/>
                    <Route path={routeMap.transferStandingOrderDetails.path} element={<StandingOrderDetails/>}/>
                    <Route path={routeMap.loanOther.path} element={<OtherLoan/>}/>
                    <Route path={routeMap.loanBatch.path} element={<BatchLoan/>}/>
                    <Route path={routeMap.receiptList.path} element={<ReceiptList/>}/>
                    <Route path={routeMap.receiptView.path} element={<ReceiptView/>}/>
                    <Route path={routeMap.dashboard.path} element={<Dashboard/>}/>
                    <Route path={routeMap.workflowRules.path} element={<WorkflowRules/>}/>
                    <Route path={routeMap.subUsers.path} element={<SubUsers/>}/>
                    <Route path={routeMap.loanInterest.path} element={<LoanInterest/>}/>
                    <Route path={routeMap.loanJunior.path} element={<LoanJunior/>}/>
                    <Route path={routeMap.messageList.path} element={<MessageList/>}/>
                    <Route path={routeMap.messageNew.path} element={<NewMessage/>}/>
                    <Route path={routeMap.messageDetail.path} element={<MessageDetail/>}/>
                    <Route path={routeMap.contactList.path} element={<ContactList/>}/>
                    <Route path={routeMap.contactNew.path} element={<ContactForm/>}/>
                    <Route path={routeMap.contactEdit.path} element={<ContactForm/>}/>
                    <Route path={routeMap.billList.path} element={<BillList/>}/>
                    <Route path={routeMap.billNew.path} element={<PayBill/>}/>
                    <Route path={routeMap.chequeList.path} element={<ChequeList/>}/>
                    <Route path={routeMap.chequeBook.path} element={<ChequeBook/>}/>
                    <Route path={routeMap.pichakInquiry.path} element={<PichakInquiry/>}/>
                    <Route path={routeMap.pichakRegister.path} element={<PichakRegister/>}/>
                    <Route path={routeMap.pichakChain.path} element={<PichakChain/>}/>
                    <Route path={routeMap.pichakOwner.path} element={<PichakOwner/>}/>
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

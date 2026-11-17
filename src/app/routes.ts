// Canonical map of paths and breadcrumb i18n keys. Reference `routeMap.x.path`
// instead of hardcoding path strings.
export const routeMap = {
	"home": {breadcrumb: "navigation.home", path: "/"},
	"account": {breadcrumb: "navigation.accounts", path: "/account"},
	"accountList": {breadcrumb: "account.listTitle", path: "/account/list"},
	"accountInfo": {breadcrumb: "account.info.title", path: "/account/info"},
	"transactionResult": {breadcrumb: "transaction.result.title", path: "/transaction-result"},
	"accountNew": {breadcrumb: "account.new.title", path: "/account/new"},
	"accountDelegate": {breadcrumb: "account.delegate.title", path: "/account/delegate-request"},
	"accountCreditCalculate": {breadcrumb: "account.credit.title", path: "/account/credit-calculate"},
	"card": {breadcrumb: "navigation.cards", path: "/card"},
	"cardList": {breadcrumb: "card.listTitle", path: "/card/list"},
	"cardInfo": {breadcrumb: "card.info.title", path: "/card/info"},
	"cardRequestList": {breadcrumb: "card.requests.title", path: "/card/request-list"},
	"cardAccountList": {breadcrumb: "card.accounts.title", path: "/card/account-list"},
	"cardConnectAccount": {breadcrumb: "card.accounts.connectTitle", path: "/card/connect-account"},
	"cardReplicaRenew": {breadcrumb: "card.replica.title", path: "/card/replica-renew"},
	"cardGift": {breadcrumb: "card.gift.title", path: "/card/gift"},
	"login": {breadcrumb: "auth.signIn", path: "/login"},
	"changePassword": {breadcrumb: "auth.changePassword", path: "/change-password"},
	"notFound": {breadcrumb: "notFound.title", path: "/404"},
}

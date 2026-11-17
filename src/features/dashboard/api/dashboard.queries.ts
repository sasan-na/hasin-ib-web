import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"

import {
	getCurrentStates,
	getHistory,
	getHistoryStates,
	getTransactionDetails,
	getWorkflowProgress,
	getWorkflows,
	type WorkflowFilter,
} from "./dashboard"

export const PAGE_SIZE = 20

export const dashboardKeys = {
	all: ["dashboard"] as const,
	states: (kind: "current" | "history") =>
		[...dashboardKeys.all, "states", kind] as const,
	current: (filter: WorkflowFilter) =>
		[...dashboardKeys.all, "current", filter] as const,
	history: (filter: WorkflowFilter) =>
		[...dashboardKeys.all, "history", filter] as const,
}

export const currentStatesOptions = () =>
	queryOptions({
		queryKey: dashboardKeys.states("current"),
		queryFn: getCurrentStates,
		staleTime: 10 * 60_000,
		retry: false,
	})
export const historyStatesOptions = () =>
	queryOptions({
		queryKey: dashboardKeys.states("history"),
		queryFn: getHistoryStates,
		staleTime: 10 * 60_000,
		retry: false,
	})

export const currentOptions = (filter: WorkflowFilter, enabled: boolean) =>
	infiniteQueryOptions({
		queryKey: dashboardKeys.current(filter),
		queryFn: ({ pageParam }) => getWorkflows(filter, pageParam, PAGE_SIZE),
		initialPageParam: 0,
		getNextPageParam: (last, pages) =>
			pages.length * PAGE_SIZE < last.total
				? pages.length * PAGE_SIZE
				: undefined,
		enabled,
		staleTime: 30_000,
		retry: false,
	})

export const historyOptions = (filter: WorkflowFilter, enabled: boolean) =>
	infiniteQueryOptions({
		queryKey: dashboardKeys.history(filter),
		queryFn: ({ pageParam }) => getHistory(filter, pageParam, PAGE_SIZE),
		initialPageParam: 0,
		getNextPageParam: (last, pages) =>
			pages.length * PAGE_SIZE < last.total
				? pages.length * PAGE_SIZE
				: undefined,
		enabled,
		staleTime: 30_000,
		retry: false,
	})

export const transactionDetailsOptions = (
	workflowRunId: number,
	serviceKey: string,
) =>
	queryOptions({
		queryKey: [
			...dashboardKeys.all,
			"details",
			workflowRunId,
			serviceKey,
		] as const,
		queryFn: () => getTransactionDetails(workflowRunId, serviceKey),
		retry: false,
	})

export const progressOptions = (workflowRunId: number) =>
	queryOptions({
		queryKey: [...dashboardKeys.all, "progress", workflowRunId] as const,
		queryFn: () => getWorkflowProgress(workflowRunId),
		retry: false,
	})

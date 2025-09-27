import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "@/server/lib/trpc";
import { userRouter } from "./user";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	helloFrom: publicProcedure.query(() => {
		return "CF+Hono+tRPC";
	}),
	privateData: protectedProcedure.query(({ ctx }) => {
		return {
			message: "This is private",
			user: ctx.session?.user,
		};
	}),
	user: userRouter,
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;

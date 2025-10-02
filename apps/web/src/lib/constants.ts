import type { QuickPrompt } from "@/web/types/chat";

/**
 * Application-wide constants
 */

export const APP_TITLE_ASCII = `

 ███████████  ███████████      █████████  █████   █████   █████████   ███████████
░░███░░░░░███░█░░░███░░░█     ███░░░░░███░░███   ░░███   ███░░░░░███ ░█░░░███░░░█
 ░███    ░███░   ░███  ░     ███     ░░░  ░███    ░███  ░███    ░███ ░   ░███  ░ 
 ░██████████     ░███       ░███          ░███████████  ░███████████     ░███    
 ░███░░░░░███    ░███       ░███          ░███░░░░░███  ░███░░░░░███     ░███    
 ░███    ░███    ░███       ░░███     ███ ░███    ░███  ░███    ░███     ░███    
 ███████████     █████       ░░█████████  █████   █████ █████   █████    █████   
░░░░░░░░░░░     ░░░░░         ░░░░░░░░░  ░░░░░   ░░░░░ ░░░░░   ░░░░░    ░░░░░    

`;

export const APP_DESCRIPTIONS = [
	"AI chat app using per-user databases powered by Durable Objects.",
	"Chat anywhere with documentation via collected MCP servers.",
	"Coming soon.",
];

export const SOCIAL_PROVIDERS = {
	GOOGLE: "google",
	GITHUB: "github",
} as const;

export type SocialProvider =
	(typeof SOCIAL_PROVIDERS)[keyof typeof SOCIAL_PROVIDERS];

export const SIGN_IN_FORM = {
	OTP_LENGTH: 6,
	VALIDATION_MESSAGES: {
		EMAIL_INVALID: "Invalid email address",
		OTP_INVALID: "OTP must be at least 6 characters",
	},
	SUCCESS_MESSAGES: {
		OTP_SENT: "Verification code sent to your email",
		SIGN_IN_SUCCESS: "Sign in successful",
	},
	LOADING_MESSAGES: {
		SENDING_OTP: "Sending code...",
		VERIFYING_OTP: "Verifying...",
	},
} as const;

/**
 * Chat-related constants used across the application
 */

export const MAX_TEXT_LENGTH = 32_000;
export const MAX_MESSAGE_BATCH = 100;

export const QUICK_PROMPTS: QuickPrompt[] = [
	{
		id: "prompt-tanstack-router",
		label: "Learn TanStack Router patterns",
		text: "Using Tanstack Router, show me how to implement nested routes with loaders.",
	},
	{
		id: "prompt-alchemy",
		label: "Create resources with Alchemy",
		text: "Alchemy is an Infrastructure as Code library for Cloudflare and other cloud providersmade by Sam Goodwin and the Alchemy team. How do I create a Durable Object resource, and how do I bind it to a Worker resource?",
	},
	{
		id: "prompt-hono",
		label: "Build API routes with Hono",
		text: "Read the Hono docs. Build a REST API with middleware for authentication, rate limiting, and CORS handling.",
	},
	{
		id: "prompt-better-auth",
		label: "Send magic links with Better Auth",
		text: "How do I use better-auth to authenticate users with magic links?",
	},
];

export const SETTINGS_NAV_ITEMS = [
	{
		to: "/settings/profile",
		label: "Profile",
		description: "View session details",
	},
	{
		to: "/settings/usage",
		label: "Usage",
		description: "Limit & token insights",
	},
	{
		to: "/settings/providers",
		label: "Providers",
		description: "Manage provider API Keys",
	},
	{
		to: "/settings/models",
		label: "Models",
		description: "Enable preferred models",
	},
	{
		to: "/settings/tools",
		label: "Tools",
		description: "Manage tool integrations",
	},
	{
		to: "/settings/appearance",
		label: "Appearance",
		description: "Change theme & UI density",
	},
] as const;

import type { QuickPrompt } from "../types/chat";

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
		id: "prompt-typescript",
		label: "Scaffold a new project with TypeScript",
		text: "Scaffold a new full-stack TypeScript project for me. Include key libraries, project structure, and initial setup commands.",
	},
	{
		id: "prompt-drizzle",
		label: "Design a database schema with Drizzle",
		text: "Design a Drizzle ORM schema for a multi-tenant SaaS app with users, organizations, and subscriptions.",
	},
	{
		id: "prompt-workers",
		label: "Deploy an app to Cloudflare Workers",
		text: "Walk me through deploying a React + Hono app to Cloudflare Workers, including wrangler configuration and deployment steps.",
	},
	{
		id: "prompt-auth",
		label: "Add authentication with Better Auth",
		text: "Explain how to integrate Better Auth into an existing React application, including server setup and client usage.",
	},
];

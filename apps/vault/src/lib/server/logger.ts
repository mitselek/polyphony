// Structured logger with user context for Cloudflare Pages logs
// Prefixes all log messages with user ID for easier debugging

export interface LogContext {
	userId?: string;
	route?: string;
	requestId?: string;
}

// Global context storage (per-request via AsyncLocalStorage would be ideal, 
// but for Cloudflare Workers we pass context explicitly)
let currentContext: LogContext = {};

/**
 * Set the current logging context (call at start of request)
 */
export function setLogContext(context: LogContext): void {
	currentContext = { ...context };
}

/**
 * Clear the logging context (call at end of request)
 */
export function clearLogContext(): void {
	currentContext = {};
}

/**
 * Format the log prefix with available context
 */
function formatPrefix(): string {
	const parts: string[] = [];
	
	if (currentContext.requestId) {
		parts.push(`[${currentContext.requestId.slice(0, 8)}]`);
	}
	
	if (currentContext.userId) {
		parts.push(`[user:${currentContext.userId.slice(0, 8)}]`);
	}
	
	if (currentContext.route) {
		parts.push(`[${currentContext.route}]`);
	}
	
	return parts.length > 0 ? parts.join(' ') + ' ' : '';
}

/**
 * Logger with context prefixing
 */
export const logger = {
	/**
	 * Log info message
	 */
	info(...args: unknown[]): void {
		const prefix = formatPrefix();
		console.log(prefix, ...args);
	},

	/**
	 * Log warning message
	 */
	warn(...args: unknown[]): void {
		const prefix = formatPrefix();
		console.warn(prefix, ...args);
	},

	/**
	 * Log error message
	 */
	error(...args: unknown[]): void {
		const prefix = formatPrefix();
		console.error(prefix, ...args);
	},

	/**
	 * Log debug message (only in development)
	 */
	debug(...args: unknown[]): void {
		// In production, this could be conditionally disabled
		const prefix = formatPrefix();
		console.log(prefix, '[DEBUG]', ...args);
	}
};

/**
 * Create a scoped logger with fixed context
 * Useful when you want to pass logger around without global state
 */
export function createScopedLogger(context: LogContext) {
	const prefix = () => {
		const parts: string[] = [];
		if (context.requestId) parts.push(`[${context.requestId.slice(0, 8)}]`);
		if (context.userId) parts.push(`[user:${context.userId.slice(0, 8)}]`);
		if (context.route) parts.push(`[${context.route}]`);
		return parts.length > 0 ? parts.join(' ') + ' ' : '';
	};

	return {
		info: (...args: unknown[]) => console.log(prefix(), ...args),
		warn: (...args: unknown[]) => console.warn(prefix(), ...args),
		error: (...args: unknown[]) => console.error(prefix(), ...args),
		debug: (...args: unknown[]) => console.log(prefix(), '[DEBUG]', ...args)
	};
}

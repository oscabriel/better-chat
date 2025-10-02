import { Brain, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/web/components/ui/badge";
import { Button } from "@/web/components/ui/button";
import { Card } from "@/web/components/ui/card";

interface ReasoningBlockProps {
	part: {
		type: string;
		text?: string;
		delta?: string;
	};
}

export function ReasoningBlock({ part }: ReasoningBlockProps) {
	const [isExpanded, setIsExpanded] = useState(false);

	if (part.type === "reasoning-start") {
		return (
			<Card className="gap-2 border-l-4 border-l-purple-500 py-2">
				<div className="p-2">
					<div className="flex flex-wrap items-center gap-1.5">
						<Brain className="h-4 w-4 text-purple-600" />
						<span className="font-medium text-sm">Thinking...</span>
						<Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
							Processing
						</Badge>
					</div>
				</div>
			</Card>
		);
	}

	if (part.type === "reasoning-delta") {
		return (
			<Card className="gap-2 border-l-4 border-l-purple-500 py-2">
				<div className="p-2">
					<div className="mb-1 flex flex-wrap items-center justify-between gap-1">
						<div className="flex flex-wrap items-center gap-1.5">
							<Brain className="h-4 w-4 text-purple-600" />
							<span className="font-medium text-sm">Reasoning</span>
							<Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
								Active
							</Badge>
						</div>
						<Button
							variant="ghost"
							size="sm"
							className="h-7 px-2 text-xs"
							onClick={() => setIsExpanded(!isExpanded)}
						>
							{isExpanded ? (
								<ChevronDown className="h-3 w-3" />
							) : (
								<ChevronRight className="h-3 w-3" />
							)}
							<span className="ml-1">Show Reasoning</span>
						</Button>
					</div>

					{isExpanded && (
						<div className="rounded bg-purple-50 p-2 text-sm dark:bg-purple-950">
							<div className="whitespace-pre-wrap font-mono text-xs">
								{part.delta || part.text}
							</div>
						</div>
					)}
				</div>
			</Card>
		);
	}

	if (part.type === "reasoning-end") {
		return (
			<Card className="gap-2 border-l-4 border-l-purple-500 py-2">
				<div className="p-2">
					<div className="flex flex-wrap items-center gap-1.5">
						<Brain className="h-4 w-4 text-purple-600" />
						<span className="font-medium text-sm">Reasoning Complete</span>
						<Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
							Complete
						</Badge>
					</div>
				</div>
			</Card>
		);
	}

	// Fallback for any other reasoning types
	return (
		<Card className="gap-2 border-l-4 border-l-purple-500 py-2">
			<div className="p-2">
				<div className="mb-1 flex flex-wrap items-center gap-1.5">
					<Brain className="h-4 w-4 text-purple-600" />
					<span className="font-medium text-sm">Reasoning</span>
				</div>
				<pre className="whitespace-pre-wrap rounded bg-muted p-1.5 text-xs">
					{JSON.stringify(part, null, 2)}
				</pre>
			</div>
		</Card>
	);
}

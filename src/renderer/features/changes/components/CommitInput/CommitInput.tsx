import { Button } from "../../../../components/ui/button";
import { ButtonGroup } from "../../../../components/ui/button-group";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "../../../../components/ui/dialog";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { toast } from "sonner";
import { Textarea } from "../../../../components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../../components/ui/tooltip";
import { useState, useEffect } from "react";
import {
	HiArrowDown,
	HiArrowsUpDown,
	HiArrowTopRightOnSquare,
	HiArrowUp,
	HiCheck,
	HiChevronDown,
} from "react-icons/hi2";
import { trpc } from "../../../../lib/trpc";

interface CommitInputProps {
	worktreePath: string;
	hasStagedChanges: boolean;
	pushCount: number;
	pullCount: number;
	hasUpstream: boolean;
	hasExistingPR: boolean;
	prUrl?: string;
	onRefresh: () => void;
}

type GitAction = "commit" | "push" | "pull" | "sync";

export function CommitInput({
	worktreePath,
	hasStagedChanges,
	pushCount,
	pullCount,
	hasUpstream,
	hasExistingPR,
	prUrl,
	onRefresh,
}: CommitInputProps) {
	const [commitMessage, setCommitMessage] = useState("");
	const [isOpen, setIsOpen] = useState(false);
	const [showGitConfigDialog, setShowGitConfigDialog] = useState(false);
	const [gitUserName, setGitUserName] = useState("");
	const [gitUserEmail, setGitUserEmail] = useState("");

	// Fetch current git config on mount
	const { data: gitConfig } = trpc.changes.getGitUserConfig.useQuery(
		{ worktreePath },
		{ enabled: !!worktreePath },
	);

	// Set initial values from git config
	useEffect(() => {
		if (gitConfig) {
			setGitUserName(gitConfig.name || "");
			setGitUserEmail(gitConfig.email || "");
		}
	}, [gitConfig]);

	const setGitUserConfigMutation = trpc.changes.setGitUserConfig.useMutation({
		onSuccess: () => {
			toast.success("Git user configured successfully");
			setShowGitConfigDialog(false);
			// Retry the commit after config is set
			if (commitMessage.trim()) {
				commitMutation.mutate({ worktreePath, message: commitMessage.trim() });
			}
		},
		onError: (error) => toast.error(`Failed to configure git: ${error.message}`),
	});

	const commitMutation = trpc.changes.commit.useMutation({
		onSuccess: (data) => {
			toast.success(data.message || "Successfully committed changes");
			setCommitMessage("");
			onRefresh();
		},
		onError: (error) => {
			// Check if error is about missing git config
			if (error.message.includes("GIT_USER_CONFIG_REQUIRED")) {
				setShowGitConfigDialog(true);
			} else {
				toast.error(`Commit failed: ${error.message}`);
			}
		},
	});

	const pushMutation = trpc.changes.push.useMutation({
		onSuccess: () => {
			toast.success("Pushed");
			onRefresh();
		},
		onError: (error) => toast.error(`Push failed: ${error.message}`),
	});

	const pullMutation = trpc.changes.pull.useMutation({
		onSuccess: () => {
			toast.success("Pulled");
			onRefresh();
		},
		onError: (error) => toast.error(`Pull failed: ${error.message}`),
	});

	const syncMutation = trpc.changes.sync.useMutation({
		onSuccess: () => {
			toast.success("Synced");
			onRefresh();
		},
		onError: (error) => toast.error(`Sync failed: ${error.message}`),
	});

	const createPRMutation = trpc.changes.createPR.useMutation({
		onSuccess: () => {
			toast.success("Opening GitHub...");
			onRefresh();
		},
		onError: (error) => toast.error(`Failed: ${error.message}`),
	});

	const isPending =
		commitMutation.isPending ||
		pushMutation.isPending ||
		pullMutation.isPending ||
		syncMutation.isPending ||
		createPRMutation.isPending;

	const canCommit = hasStagedChanges && commitMessage.trim();

	const handleCommit = () => {
		if (!canCommit) return;
		commitMutation.mutate({ worktreePath, message: commitMessage.trim() });
	};

	const handlePush = () =>
		pushMutation.mutate({ worktreePath, setUpstream: true });
	const handlePull = () => pullMutation.mutate({ worktreePath });
	const handleSync = () => syncMutation.mutate({ worktreePath });
	const handleCreatePR = () => createPRMutation.mutate({ worktreePath });
	const handleOpenPR = () => prUrl && window.open(prUrl, "_blank");

	const handleCommitAndPush = () => {
		if (!canCommit) return;
		commitMutation.mutate(
			{ worktreePath, message: commitMessage.trim() },
			{ onSuccess: handlePush },
		);
	};

	const handleCommitPushAndCreatePR = () => {
		if (!canCommit) return;
		commitMutation.mutate(
			{ worktreePath, message: commitMessage.trim() },
			{
				onSuccess: () => {
					pushMutation.mutate(
						{ worktreePath, setUpstream: true },
						{ onSuccess: handleCreatePR },
					);
				},
			},
		);
	};

	// Determine primary action based on state
	const getPrimaryAction = (): {
		action: GitAction;
		label: string;
		icon: React.ReactNode;
		handler: () => void;
		disabled: boolean;
		tooltip: string;
	} => {
		if (canCommit) {
			return {
				action: "commit",
				label: "Commit",
				icon: <HiCheck className="size-4" />,
				handler: handleCommit,
				disabled: isPending,
				tooltip: "Commit staged changes",
			};
		}
		if (pushCount > 0 && pullCount > 0) {
			return {
				action: "sync",
				label: "Sync",
				icon: <HiArrowsUpDown className="size-4" />,
				handler: handleSync,
				disabled: isPending,
				tooltip: `Pull ${pullCount}, push ${pushCount}`,
			};
		}
		if (pushCount > 0) {
			return {
				action: "push",
				label: "Push",
				icon: <HiArrowUp className="size-4" />,
				handler: handlePush,
				disabled: isPending,
				tooltip: `Push ${pushCount} commit${pushCount !== 1 ? "s" : ""}`,
			};
		}
		if (pullCount > 0) {
			return {
				action: "pull",
				label: "Pull",
				icon: <HiArrowDown className="size-4" />,
				handler: handlePull,
				disabled: isPending,
				tooltip: `Pull ${pullCount} commit${pullCount !== 1 ? "s" : ""}`,
			};
		}
		// No upstream - show Publish Branch option
		if (!hasUpstream) {
			return {
				action: "push",
				label: "Publish Branch",
				icon: <HiArrowUp className="size-4" />,
				handler: handlePush,
				disabled: isPending,
				tooltip: "Publish branch to remote",
			};
		}
		return {
			action: "commit",
			label: "Commit",
			icon: <HiCheck className="size-4" />,
			handler: handleCommit,
			disabled: true,
			tooltip: hasStagedChanges ? "Enter a message" : "No staged changes",
		};
	};

	const primary = getPrimaryAction();

	// Format count badge
	const countBadge =
		pushCount > 0 || pullCount > 0
			? `${pullCount > 0 ? pullCount : ""}${pullCount > 0 && pushCount > 0 ? "/" : ""}${pushCount > 0 ? pushCount : ""}`
			: null;

	const handleSaveGitConfig = () => {
		if (!gitUserName.trim() || !gitUserEmail.trim()) {
			toast.error("Please enter both username and email");
			return;
		}
		setGitUserConfigMutation.mutate({
			worktreePath,
			name: gitUserName.trim(),
			email: gitUserEmail.trim(),
		});
	};

	return (
		<>
			<Dialog open={showGitConfigDialog} onOpenChange={setShowGitConfigDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Configure Git User</DialogTitle>
						<DialogDescription>
							Please configure your git username and email to commit changes. This is required for your first commit.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="git-name">Name</Label>
							<Input
								id="git-name"
								value={gitUserName}
								onChange={(e) => setGitUserName(e.target.value)}
								placeholder="Your name"
								autoFocus
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="git-email">Email</Label>
							<Input
								id="git-email"
								type="email"
								value={gitUserEmail}
								onChange={(e) => setGitUserEmail(e.target.value)}
								placeholder="your.email@example.com"
							/>
						</div>
						<div className="flex justify-end gap-2 pt-2">
							<Button
								variant="secondary"
								onClick={() => setShowGitConfigDialog(false)}
								disabled={setGitUserConfigMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								onClick={handleSaveGitConfig}
								disabled={setGitUserConfigMutation.isPending || !gitUserName.trim() || !gitUserEmail.trim()}
							>
								{setGitUserConfigMutation.isPending ? "Saving..." : "Save & Continue"}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			<div className="flex flex-col gap-1.5 px-2 py-2 border-b border-border">
				<Textarea
				placeholder="Commit message"
				value={commitMessage}
				onChange={(e) => setCommitMessage(e.target.value)}
				className="min-h-[52px] resize-none text-[10px] bg-background"
				onKeyDown={(e) => {
					if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canCommit) {
						e.preventDefault();
						handleCommit();
					}
				}}
			/>
			<ButtonGroup className="w-full">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="secondary"
							size="sm"
							className="flex-1 gap-1.5 h-7 text-xs"
							onClick={primary.handler}
							disabled={primary.disabled}
						>
							{primary.icon}
							<span>{primary.label}</span>
							{countBadge && (
								<span className="text-[10px] opacity-70">{countBadge}</span>
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">{primary.tooltip}</TooltipContent>
				</Tooltip>
				<DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
					<DropdownMenuTrigger asChild>
						<Button
							variant="secondary"
							size="sm"
							disabled={isPending}
							className="h-7 px-1.5"
						>
							<HiChevronDown className="size-3.5" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-48 text-xs">
						{/* Commit actions */}
						<DropdownMenuItem
							onClick={handleCommit}
							disabled={!canCommit}
							className="text-xs"
						>
							<HiCheck className="size-3.5" />
							Commit
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={handleCommitAndPush}
							disabled={!canCommit}
							className="text-xs"
						>
							<HiArrowUp className="size-3.5" />
							Commit & Push
						</DropdownMenuItem>
						{!hasExistingPR && (
							<DropdownMenuItem
								onClick={handleCommitPushAndCreatePR}
								disabled={!canCommit}
								className="text-xs"
							>
								<HiArrowTopRightOnSquare className="size-3.5" />
								Commit, Push & Create PR
							</DropdownMenuItem>
						)}

						<DropdownMenuSeparator />

						<DropdownMenuItem
							onClick={handlePush}
							disabled={pushCount === 0 && hasUpstream}
							className="text-xs"
						>
							<HiArrowUp className="size-3.5" />
							<span className="flex-1">
								{hasUpstream ? "Push" : "Publish Branch"}
							</span>
							{pushCount > 0 && (
								<span className="text-[10px] text-muted-foreground">
									{pushCount}
								</span>
							)}
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={handlePull}
							disabled={pullCount === 0}
							className="text-xs"
						>
							<HiArrowDown className="size-3.5" />
							<span className="flex-1">Pull</span>
							{pullCount > 0 && (
								<span className="text-[10px] text-muted-foreground">
									{pullCount}
								</span>
							)}
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={handleSync}
							disabled={pushCount === 0 && pullCount === 0}
							className="text-xs"
						>
							<HiArrowsUpDown className="size-3.5" />
							Sync
						</DropdownMenuItem>

						<DropdownMenuSeparator />

						{hasExistingPR ? (
							<DropdownMenuItem onClick={handleOpenPR} className="text-xs">
								<HiArrowTopRightOnSquare className="size-3.5" />
								Open Pull Request
							</DropdownMenuItem>
						) : (
							<DropdownMenuItem onClick={handleCreatePR} className="text-xs">
								<HiArrowTopRightOnSquare className="size-3.5" />
								Create Pull Request
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</ButtonGroup>
		</div>
		</>
	);
}

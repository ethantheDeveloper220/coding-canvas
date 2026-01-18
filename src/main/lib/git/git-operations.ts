import { shell } from "electron";
import simpleGit from "simple-git";
import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { isUpstreamMissingError } from "./git-utils";
import { assertRegisteredWorktree } from "./security";
import { fetchGitHubPRStatus } from "./github";

export { isUpstreamMissingError };

async function hasUpstreamBranch(
	git: ReturnType<typeof simpleGit>,
): Promise<boolean> {
	try {
		await git.raw(["rev-parse", "--abbrev-ref", "@{upstream}"]);
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if git user name and email are configured
 */
async function getGitUserConfig(
	git: ReturnType<typeof simpleGit>,
): Promise<{ name: string | null; email: string | null }> {
	try {
		const [name, email] = await Promise.all([
			git.getConfig("user.name").catch(() => ({ value: null })),
			git.getConfig("user.email").catch(() => ({ value: null })),
		]);
		return {
			name: name.value || null,
			email: email.value || null,
		};
	} catch {
		return { name: null, email: null };
	}
}

/**
 * Ensure git user config is set before committing
 */
async function ensureGitUserConfig(git: ReturnType<typeof simpleGit>): Promise<void> {
	const config = await getGitUserConfig(git);
	if (!config.name || !config.email) {
		throw new Error(
			"GIT_USER_CONFIG_REQUIRED: Please configure your git username and email before committing",
		);
	}
}

export const createGitOperationsRouter = () => {
	return router({
		// NOTE: saveFile is defined in file-contents.ts with hardened path validation
		// Do NOT add saveFile here - it would overwrite the secure version

		commit: publicProcedure
			.input(
				z.object({
					worktreePath: z.string(),
					message: z.string(),
				}),
			)
			.mutation(
				async ({ input }): Promise<{ success: boolean; hash: string; message?: string }> => {
					assertRegisteredWorktree(input.worktreePath);

					const git = simpleGit(input.worktreePath);

					// Check if git user config is set
					await ensureGitUserConfig(git);

					// Stage all changes (git's built-in binary detection will handle filtering via .gitignore and attributes)
					await git.add("-A");

					// Check if there are actually changes to commit
					const newStatus = await git.status();
					const hasChanges = newStatus.staged.length > 0;

					if (!hasChanges) {
						throw new Error("No changes to commit (binary files are automatically excluded)");
					}

					const result = await git.commit(input.message);
					return { 
						success: true, 
						hash: result.commit,
						message: "Successfully committed changes",
					};
				},
			),

		push: publicProcedure
			.input(
				z.object({
					worktreePath: z.string(),
					setUpstream: z.boolean().optional(),
				}),
			)
			.mutation(async ({ input }): Promise<{ success: boolean }> => {
				assertRegisteredWorktree(input.worktreePath);

				const git = simpleGit(input.worktreePath);
				const hasUpstream = await hasUpstreamBranch(git);

				if (input.setUpstream && !hasUpstream) {
					const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
					await git.push(["--set-upstream", "origin", branch.trim()]);
				} else {
					await git.push();
				}
				await git.fetch();
				return { success: true };
			}),

		pull: publicProcedure
			.input(
				z.object({
					worktreePath: z.string(),
				}),
			)
			.mutation(async ({ input }): Promise<{ success: boolean }> => {
				assertRegisteredWorktree(input.worktreePath);

				const git = simpleGit(input.worktreePath);
				try {
					await git.pull(["--rebase"]);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					if (isUpstreamMissingError(message)) {
						throw new Error(
							"No upstream branch to pull from. The remote branch may have been deleted.",
						);
					}
					throw error;
				}
				return { success: true };
			}),

		sync: publicProcedure
			.input(
				z.object({
					worktreePath: z.string(),
				}),
			)
			.mutation(async ({ input }): Promise<{ success: boolean }> => {
				assertRegisteredWorktree(input.worktreePath);

				const git = simpleGit(input.worktreePath);
				try {
					await git.pull(["--rebase"]);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					if (isUpstreamMissingError(message)) {
						const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
						await git.push(["--set-upstream", "origin", branch.trim()]);
						await git.fetch();
						return { success: true };
					}
					throw error;
				}
				await git.push();
				await git.fetch();
				return { success: true };
			}),

		createPR: publicProcedure
			.input(
				z.object({
					worktreePath: z.string(),
				}),
			)
			.mutation(
				async ({ input }): Promise<{ success: boolean; url: string }> => {
					assertRegisteredWorktree(input.worktreePath);

					const git = simpleGit(input.worktreePath);
					const branch = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();
					const hasUpstream = await hasUpstreamBranch(git);

					// Ensure branch is pushed first
					if (!hasUpstream) {
						await git.push(["--set-upstream", "origin", branch]);
					} else {
						// Push any unpushed commits
						await git.push();
					}

					// Get the remote URL to construct the GitHub compare URL
					const remoteUrl = (await git.remote(["get-url", "origin"])) || "";
					const repoMatch = remoteUrl
						.trim()
						.match(/github\.com[:/](.+?)(?:\.git)?$/);

					if (!repoMatch) {
						throw new Error("Could not determine GitHub repository URL");
					}

					const repo = repoMatch[1].replace(/\.git$/, "");
					const url = `https://github.com/${repo}/compare/${branch}?expand=1`;

					await shell.openExternal(url);
					await git.fetch();

					return { success: true, url };
				},
			),

		getGitHubStatus: publicProcedure
			.input(
				z.object({
					worktreePath: z.string(),
				}),
			)
			.query(async ({ input }) => {
				assertRegisteredWorktree(input.worktreePath);
				return await fetchGitHubPRStatus(input.worktreePath);
			}),

		/**
		 * Get git user configuration (name and email)
		 */
		getGitUserConfig: publicProcedure
			.input(
				z.object({
					worktreePath: z.string(),
				}),
			)
			.query(async ({ input }) => {
				assertRegisteredWorktree(input.worktreePath);
				const git = simpleGit(input.worktreePath);
				return await getGitUserConfig(git);
			}),

		/**
		 * Set git user configuration (name and email)
		 */
		setGitUserConfig: publicProcedure
			.input(
				z.object({
					worktreePath: z.string(),
					name: z.string().min(1),
					email: z.string().email().min(1),
				}),
			)
			.mutation(async ({ input }) => {
				assertRegisteredWorktree(input.worktreePath);
				const git = simpleGit(input.worktreePath);

				await git.addConfig("user.name", input.name, false, "local");
				await git.addConfig("user.email", input.email, false, "local");

				return { success: true, name: input.name, email: input.email };
			}),

		/**
		 * Get git remote URL (GitHub URL)
		 */
		getGitRemoteUrl: publicProcedure
			.input(
				z.object({
					worktreePath: z.string(),
				}),
			)
			.query(async ({ input }) => {
				assertRegisteredWorktree(input.worktreePath);
				const git = simpleGit(input.worktreePath);

				try {
					const remoteUrl = await git.remote(["get-url", "origin"]);
					return { url: remoteUrl.trim() || null };
				} catch {
					return { url: null };
				}
			}),

		/**
		 * Set git remote URL (GitHub URL)
		 */
		setGitRemoteUrl: publicProcedure
			.input(
				z.object({
					worktreePath: z.string(),
					url: z.string().url(),
				}),
			)
			.mutation(async ({ input }) => {
				assertRegisteredWorktree(input.worktreePath);
				const git = simpleGit(input.worktreePath);

				// Check if remote already exists
				try {
					await git.remote(["get-url", "origin"]);
					// Remote exists, update it
					await git.remote(["set-url", "origin", input.url]);
				} catch {
					// Remote doesn't exist, add it
					await git.addRemote("origin", input.url);
				}

				return { success: true, url: input.url };
			}),
	});
};

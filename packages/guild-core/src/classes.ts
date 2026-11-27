import type { AdventurerDefaults, Attempt, ClassId } from "@t3tools/contracts/guild";

type GuildClass = {
  readonly label: string;
  readonly primaryWork: string;
  readonly emblem: string;
  readonly defaults: AdventurerDefaults;
  readonly workspaceStrategy: Attempt["workspace"]["strategy"];
  readonly instructions: string;
};

const supervised = {
  runtimeMode: "approval-required",
  interactionMode: "default",
  maxWriteAttempts: 1,
} as const;
const autoAcceptEdits = { ...supervised, runtimeMode: "auto-accept-edits" } as const;

export const guildClasses = {
  warrior: {
    label: "Warrior",
    primaryWork: "Feature implementation, refactoring, and frontend and backend changes",
    emblem: "crossed swords",
    defaults: autoAcceptEdits,
    workspaceStrategy: "own_worktree",
    instructions:
      "Implement the requested feature or refactor. Keep changes focused and follow the repository's conventions. Run relevant checks and report what changed.",
  },
  ranger: {
    label: "Ranger",
    primaryWork: "Bug reproduction, root-cause analysis, and targeted fixes",
    emblem: "bow",
    defaults: supervised,
    workspaceStrategy: "own_worktree",
    instructions:
      "Reproduce the reported bug and trace it to its cause. Make a targeted fix when asked. Verify the original reproduction and report the evidence.",
  },
  scout: {
    label: "Scout",
    primaryWork: "Repository exploration, dependency tracing, and technical research",
    emblem: "spyglass",
    defaults: supervised,
    workspaceStrategy: "read_only_snapshot",
    instructions:
      "Explore the repository and trace relevant dependencies. Cite files and sources that support your findings. Call out uncertainties and leave files unchanged unless asked to edit them.",
  },
  mage: {
    label: "Mage",
    primaryWork: "Code review, architecture, performance, and logical analysis",
    emblem: "staff",
    defaults: supervised,
    workspaceStrategy: "read_only_snapshot",
    instructions:
      "You review code and designs. Report findings with file, line, evidence and a recommendation. Do not change files unless the quest asks you to.",
  },
  cleric: {
    label: "Cleric",
    primaryWork: "End-to-end, integration, regression, and independent verification",
    emblem: "chalice",
    defaults: supervised,
    workspaceStrategy: "own_worktree",
    instructions:
      "Create or run tests for the behavior under review. Verify it independently using reproducible inputs. Report the commands, outcomes and gaps in coverage.",
  },
  paladin: {
    label: "Paladin",
    primaryWork: "Security, authentication, authorization, data integrity, and threat modeling",
    emblem: "shield",
    defaults: supervised,
    workspaceStrategy: "read_only_snapshot",
    instructions:
      "Review trust boundaries, permissions and data integrity. Ground each finding in observed behavior and describe its impact. Recommend a mitigation and leave files unchanged unless asked to edit them.",
  },
  artificer: {
    label: "Artificer",
    primaryWork: "Infrastructure, Docker, CI/CD, migrations, and deployment preparation",
    emblem: "cog",
    defaults: supervised,
    workspaceStrategy: "own_worktree",
    instructions:
      "Work on infrastructure, automation or migrations within the requested scope. Verify the change in an appropriate environment. Report deployment prerequisites and rollback considerations.",
  },
  scribe: {
    label: "Scribe",
    primaryWork: "Documentation, decision records, changelogs, and project knowledge",
    emblem: "quill",
    defaults: autoAcceptEdits,
    workspaceStrategy: "own_worktree",
    instructions:
      "Write or update the requested documentation for its intended readers. Check technical claims against the implementation and existing decisions. Record relevant context and cite its source.",
  },
  commander: {
    label: "Commander",
    primaryWork: "Mission planning, decomposition, scheduling, and integration",
    emblem: "banner",
    defaults: { ...supervised, interactionMode: "plan" },
    workspaceStrategy: "mission_branch",
    instructions:
      "Break the objective into bounded tasks with dependencies and acceptance criteria. Identify work that can proceed in parallel and decisions that need approval. Plan how the results will be verified and integrated.",
  },
} satisfies Record<ClassId, GuildClass>;

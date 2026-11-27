import * as Schema from "effect/Schema";
import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { isReasoningSelect } from "@t3tools/client-runtime/model-traits";
import type { EnvironmentId, ProviderInstanceId, ServerProvider } from "@t3tools/contracts";
import { ClassId, GuildCandidateGoneError, type ModelBinding } from "@t3tools/contracts/guild";
import { resolveBinding } from "@t3tools/guild-core/binding";
import { guildClasses } from "@t3tools/guild-core/classes";
import { deriveFamilies } from "@t3tools/guild-core/families";
import { useContext, useState } from "react";

import {
  resolveRuntimeModeOptions,
  runtimeModeOptions,
} from "../../../components/chat/runtimeModeConfig";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { useEnvironment } from "../../../state/environments";
import { useAtomCommand } from "../../../state/use-atom-command";
import { guildCommandError, guildCommandId, guildEnvironment } from "../../state/guild";
import { candidateId, type Candidate } from "../../state/presentation";
import { ClassEmblem } from "../AdventurerIdentity";
import { GuildOverlay, GuildSelect, useGuildAction } from "../GuildOverlay";
import { Portrait } from "../Portrait";

const isGuildCandidateGoneError = Schema.is(GuildCandidateGoneError);

export function useRefreshCandidates(environmentId: EnvironmentId) {
  const allowed = useAtomValue(guildEnvironment.refreshCandidates.permissionAtom(environmentId));
  const refresh = useAtomCommand(guildEnvironment.refreshCandidates, { reportFailure: false });
  const action = useGuildAction();
  return {
    ...action,
    allowed,
    refresh: () =>
      action.run(async () => {
        if (!allowed) return;
        const result = await refresh({ environmentId, input: { commandId: guildCommandId() } });
        if (result._tag === "Failure") throw guildCommandError(result);
      }),
  };
}

export function RecruitmentDesk({
  candidates,
  action,
  openCandidate,
  onClose,
}: {
  candidates: readonly Candidate[];
  action: ReturnType<typeof useRefreshCandidates>;
  openCandidate: (candidate: Candidate) => void;
  onClose: () => void;
}) {
  return (
    <GuildOverlay title="Recruitment Hall" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        {candidates.map((candidate) => (
          <div
            key={candidateId(candidate)}
            className="flex flex-col items-center gap-2 rounded-lg border p-3"
          >
            <Portrait appearance={candidate.appearance} />
            <Button variant="outline" size="sm" onClick={() => openCandidate(candidate)}>
              {candidate.name}
            </Button>
          </div>
        ))}
      </div>
      {action.error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {action.error.message}
        </p>
      )}
      <div className="mt-4">
        <Button
          variant="secondary"
          onClick={() => void action.refresh()}
          disabled={!action.allowed || action.pending}
        >
          Refresh candidates
        </Button>
      </div>
    </GuildOverlay>
  );
}

function providerUnavailable(provider: ServerProvider) {
  const result = resolveBinding(
    {
      providerInstanceId: provider.instanceId,
      family: { key: "", label: "" },
      pinnedModel: null,
      options: null,
    },
    [provider],
  );
  return "error" in result && result.error.code === "provider_unavailable"
    ? result.error.reason
    : provider.models.length === 0
      ? "This provider offers no models."
      : undefined;
}

export function HireAdventurer({
  candidate,
  environmentId,
  providers,
  onClose,
  onBack,
}: {
  candidate: Candidate;
  environmentId: EnvironmentId;
  providers: readonly ServerProvider[];
  onClose: () => void;
  onBack: () => void;
}) {
  const [classId, setClassId] = useState<ClassId | null>(null);
  const [providerId, setProviderId] = useState<ProviderInstanceId | null>(null);
  const [familyKey, setFamilyKey] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [effort, setEffort] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [runtimeMode, setRuntimeMode] = useState<(typeof runtimeModeOptions)[number] | null>(null);
  const [interactionMode, setInteractionMode] = useState<"default" | "plan" | null>(null);
  const [candidateGone, setCandidateGone] = useState(false);
  const registry = useContext(RegistryContext);
  const environment = useEnvironment(environmentId);
  const action = useGuildAction();
  const allowed = useAtomValue(guildEnvironment.hireAdventurer.permissionAtom(environmentId));
  const hire = useAtomCommand(guildEnvironment.hireAdventurer, { reportFailure: false });

  const provider = providers.find(({ instanceId }) => instanceId === providerId);
  const families = provider ? deriveFamilies(provider) : [];
  const family = families.find(({ key }) => key === familyKey);
  const unconfigured =
    provider && family
      ? ({
          providerInstanceId: provider.instanceId,
          family: { key: family.key, label: family.label },
          pinnedModel: pin,
          options: null,
        } satisfies ModelBinding)
      : null;
  const modelSelection = unconfigured ? resolveBinding(unconfigured, providers) : null;
  const model =
    modelSelection && "ok" in modelSelection
      ? family?.models.find(({ slug }) => slug === modelSelection.ok.model)
      : undefined;
  const reasoning = model?.capabilities?.optionDescriptors?.find(isReasoningSelect);
  const binding = unconfigured && {
    ...unconfigured,
    options: reasoning && effort ? { [reasoning.id]: effort } : null,
  };
  const bindingCheck = binding ? resolveBinding(binding, providers) : null;
  const modes = resolveRuntimeModeOptions(
    runtimeModeOptions,
    environment?.serverConfig?.managedPolicy,
  ).map(({ mode, label, disabledReason }) => ({
    value: mode,
    label,
    disabled: Boolean(
      disabledReason ||
      (provider?.supportedRuntimeModes?.length && !provider.supportedRuntimeModes.includes(mode)),
    ),
    description:
      disabledReason ??
      (provider?.supportedRuntimeModes?.length && !provider.supportedRuntimeModes.includes(mode)
        ? "This provider does not support this policy."
        : undefined),
  }));
  const selectedMode = modes.find(({ value }) => value === runtimeMode);
  const canHire =
    allowed &&
    !candidateGone &&
    classId &&
    binding &&
    bindingCheck &&
    "ok" in bindingCheck &&
    selectedMode &&
    !selectedMode.disabled &&
    interactionMode;

  return (
    <GuildOverlay title={`Hire ${candidate.name}`} onClose={onClose} wide>
      <div className="mb-4 flex items-center gap-3">
        <Portrait appearance={candidate.appearance} animate />
        <div>
          <p className="text-sm text-muted-foreground">Level 0 · New recruit</p>
        </div>
      </div>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canHire || !classId || !binding || !runtimeMode || !interactionMode) return;
          void action.run(async () => {
            const result = await hire({
              environmentId,
              input: {
                commandId: guildCommandId(),
                pool: { seed: candidate.seed, index: candidate.index },
                classId,
                binding,
                defaults: { ...guildClasses[classId].defaults, runtimeMode, interactionMode },
                specialties: specialties
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
                instructions,
              },
            });
            if (result._tag === "Failure") {
              const error = guildCommandError(result);
              if (isGuildCandidateGoneError(error)) {
                setCandidateGone(true);
                registry.refresh(guildEnvironment.state(environmentId));
              }
              throw error;
            }
            onClose();
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <GuildSelect
            label="Class"
            placeholder="Choose a class"
            value={classId}
            choices={ClassId.literals.map((id) => ({
              value: id,
              label: guildClasses[id].label,
              description: guildClasses[id].primaryWork,
              icon: <ClassEmblem classId={id} />,
            }))}
            onChange={(id) => {
              if (!id) return;
              const selected = guildClasses[id];
              setClassId(id);
              setRuntimeMode(selected.defaults.runtimeMode);
              setInteractionMode(selected.defaults.interactionMode);
              setInstructions(selected.instructions);
            }}
          />
          <GuildSelect
            label="Provider"
            placeholder="Choose a provider"
            value={providerId}
            choices={providers.map((instance) => {
              const description = providerUnavailable(instance);
              return {
                value: instance.instanceId,
                label: instance.displayName ?? instance.driver,
                description,
                disabled: description !== undefined,
              };
            })}
            onChange={(id) => {
              setProviderId(id);
              setFamilyKey(null);
              setPin(null);
              setEffort(null);
            }}
          />
          <GuildSelect
            label="Model family"
            placeholder="Choose a family"
            value={familyKey}
            disabled={!provider}
            choices={families.map(({ key, label }) => ({ value: key, label }))}
            onChange={(key) => {
              setFamilyKey(key);
              setPin(null);
              setEffort(null);
            }}
          />
          <GuildSelect
            label="Pin a model"
            value={pin ?? ""}
            disabled={!family}
            choices={[
              { value: "", label: "Use the family default" },
              ...(family?.models ?? []).map(({ slug, name }) => ({ value: slug, label: name })),
            ]}
            onChange={(slug) => {
              setPin(slug || null);
              setEffort(null);
            }}
          />
          {reasoning && (
            <GuildSelect
              label="Reasoning effort"
              value={effort ?? ""}
              choices={[
                { value: "", label: "Use the model default" },
                ...reasoning.options.map(({ id, label }) => ({ value: id, label })),
              ]}
              onChange={(value) => setEffort(value || null)}
            />
          )}
          <GuildSelect
            label="Permission policy"
            placeholder="Choose a policy"
            value={runtimeMode}
            choices={modes}
            onChange={setRuntimeMode}
          />
          <GuildSelect
            label="Interaction mode"
            placeholder="Choose a mode"
            value={interactionMode}
            onChange={setInteractionMode}
            choices={[
              { value: "default", label: "Default" },
              { value: "plan", label: "Plan" },
            ]}
          />
          <div className="grid gap-1.5">
            <Label htmlFor="guild-specialties">Specialties</Label>
            <Input
              id="guild-specialties"
              placeholder="Separate tags with commas"
              value={specialties}
              onChange={(event) => setSpecialties(event.currentTarget.value)}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="guild-instructions">Instructions</Label>
          <Textarea
            id="guild-instructions"
            rows={4}
            value={instructions}
            onChange={(event) => setInstructions(event.currentTarget.value)}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Tools ·{" "}
          {provider
            ? `Provider tools as configured in T3 for ${provider.displayName ?? provider.driver}, under the permission policy above.`
            : "Choose a provider to see which tools apply."}
        </p>
        {bindingCheck && "error" in bindingCheck && (
          <p role="alert" className="text-sm text-destructive">
            {bindingCheck.error.reason}
          </p>
        )}
        {action.error && (
          <p role="alert" className="text-sm text-destructive">
            {action.error.message}
          </p>
        )}
        <div className="flex justify-between gap-2">
          <Button type="button" variant="outline" onClick={onBack}>
            Back to candidates
          </Button>
          <Button type="submit" disabled={!canHire || action.pending}>
            Hire
          </Button>
        </div>
      </form>
    </GuildOverlay>
  );
}

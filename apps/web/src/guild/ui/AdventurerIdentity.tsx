import { Link } from "@tanstack/react-router";
import type { EnvironmentId, ProviderInstanceId } from "@t3tools/contracts";
import type { ClassId } from "@t3tools/contracts/guild";
import { guildClasses } from "@t3tools/guild-core/classes";
import {
  CogIcon,
  FlagIcon,
  GlassWaterIcon,
  PenToolIcon,
  ShieldIcon,
  SwordsIcon,
  TelescopeIcon,
  WandIcon,
  TargetIcon,
} from "lucide-react";

const classIcons = {
  warrior: SwordsIcon,
  ranger: TargetIcon,
  scout: TelescopeIcon,
  mage: WandIcon,
  cleric: GlassWaterIcon,
  paladin: ShieldIcon,
  artificer: CogIcon,
  scribe: PenToolIcon,
  commander: FlagIcon,
} satisfies Record<ClassId, typeof SwordsIcon>;

export function ClassEmblem({ classId }: { classId: ClassId }) {
  const Icon = classIcons[classId];
  return <Icon aria-hidden className="size-4 shrink-0" />;
}

export function AdventurerIdentity({
  classId,
  level,
  family,
  pin,
}: {
  classId: ClassId;
  level: number;
  family: string;
  pin: string | null;
}) {
  return (
    <div className="grid gap-1 text-sm text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <ClassEmblem classId={classId} /> {guildClasses[classId].label} · Level {level}
      </span>
      <span>
        {family}
        {pin === null ? "" : ` · Pinned: ${pin}`}
      </span>
    </div>
  );
}

export function ProviderBindingIssue({
  environmentId,
  instanceId,
  family,
  reason,
}: {
  environmentId: EnvironmentId;
  instanceId: ProviderInstanceId;
  family: string;
  reason: string;
}) {
  return (
    <div role="alert" className="mb-4 text-sm text-destructive">
      <p>
        {family} · {reason}
      </p>
      <Link to="/settings/providers" search={{ environmentId, instanceId }} className="underline">
        Open provider settings
      </Link>
    </div>
  );
}

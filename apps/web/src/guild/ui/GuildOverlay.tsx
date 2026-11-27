import { useId, useRef, useState, type ReactNode } from "react";

import { Dialog, DialogPopup, DialogTitle } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectPopup,
  SelectTrigger,
  SelectItem,
  SelectValue,
} from "../../components/ui/select";

export function GuildOverlay({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPopup className={wide ? "max-w-3xl" : undefined}>
        <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
          <DialogTitle className="me-8 mb-4">{title}</DialogTitle>
          {children}
        </div>
      </DialogPopup>
    </Dialog>
  );
}

export function GuildSelect<Value extends string>({
  label,
  placeholder,
  value,
  onChange,
  choices,
  disabled = false,
}: {
  label: string;
  placeholder?: string;
  value: Value | null;
  onChange: (value: Value | null) => void;
  choices: readonly {
    value: Value;
    label: string;
    description?: string | undefined;
    icon?: ReactNode;
    disabled?: boolean | undefined;
  }[];
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} items={choices} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectPopup alignItemWithTrigger={false}>
          {choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value} disabled={choice.disabled}>
              <span className="flex items-center gap-1.5">
                {choice.icon}
                {choice.label}
              </span>
              {choice.description && (
                <span className="block text-xs text-muted-foreground">{choice.description}</span>
              )}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </div>
  );
}

export function useGuildAction() {
  const running = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const run = async (action: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setPending(true);
    setError(null);
    await action().catch((cause: unknown) => {
      setError(
        cause instanceof Error ? cause : new Error("The Guild action could not be completed."),
      );
    });
    running.current = false;
    setPending(false);
  };
  return { pending, error, run };
}

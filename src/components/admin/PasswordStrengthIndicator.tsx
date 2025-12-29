import { CheckCircle2, XCircle } from "lucide-react";

interface PasswordStrengthIndicatorProps {
  password: string;
  minLength?: number;
}

export function PasswordStrengthIndicator({ password, minLength = 8 }: PasswordStrengthIndicatorProps) {
  if (!password) return null;

  const checks = {
    length: password.length >= minLength,
  };

  const strength = checks.length ? "valid" : "invalid";
  const allValid = checks.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        {allValid ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <XCircle className="h-4 w-4 text-gray-400" />
        )}
        <span className={allValid ? "text-green-600 font-medium" : "text-muted-foreground"}>
          Siła hasła: {allValid ? "Wystarczające" : "Niewystarczające"}
        </span>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {checks.length ? (
            <CheckCircle2 className="h-3 w-3 text-green-600" />
          ) : (
            <XCircle className="h-3 w-3 text-gray-400" />
          )}
          <span className={checks.length ? "text-green-600" : ""}>
            Co najmniej {minLength} znaków
          </span>
        </div>
      </div>
    </div>
  );
}

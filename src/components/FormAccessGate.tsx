import { useEffect, useState, type ReactNode } from "react";

import { EcoleDucasseBrand } from "@/components/EcoleDucasseBrand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  checkFormAccessPassword,
  grantFormAccess,
  isFormAccessGranted,
} from "@/lib/form-access";

type FormAccessGateProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function FormAccessGate({ title, description, children }: FormAccessGateProps) {
  const [granted, setGranted] = useState(false);
  const [ready, setReady] = useState(false);
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setGranted(isFormAccessGranted());
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <CenterShell>
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </CenterShell>
    );
  }

  if (!granted) {
    return (
      <CenterShell>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            if (checkFormAccessPassword(pwd)) {
              grantFormAccess();
              setGranted(true);
              return;
            }
            setError("Mot de passe incorrect");
          }}
          className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6"
        >
          <EcoleDucasseBrand
            asLink={false}
            variant="inverse"
            className="mb-2 max-w-none flex-col items-center rounded-md bg-primary p-4 sm:flex-col"
            logoClassName="mx-auto h-auto w-full max-h-24 object-contain object-center"
          />
          <div className="text-center">
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Mot de passe</Label>
            <Input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full">
            Accéder au formulaire
          </Button>
        </form>
      </CenterShell>
    );
  }

  return <>{children}</>;
}

function CenterShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      {children}
    </div>
  );
}

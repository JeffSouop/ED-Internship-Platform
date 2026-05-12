import type {
  Company,
  CompanyDeclaration,
  LinkToken,
  Student,
  StudentSubmission,
} from "@/lib/types";
import {
  seedCompanies,
  seedDeclarations,
  seedStudents,
  seedSubmissions,
  seedTokens,
} from "./seed";

const STORAGE_KEY = "ducasse-careers-store-v1";

export interface Store {
  students: Student[];
  submissions: StudentSubmission[];
  companies: Company[];
  declarations: CompanyDeclaration[];
  tokens: LinkToken[];
}

const defaults: Store = {
  students: seedStudents,
  submissions: seedSubmissions,
  companies: seedCompanies,
  declarations: seedDeclarations,
  tokens: seedTokens,
};

let memory: Store | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

export function getStore(): Store {
  if (memory) return memory;
  if (isBrowser()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        memory = JSON.parse(raw) as Store;
        return memory;
      }
    } catch {
      // ignore
    }
  }
  memory = structuredClone(defaults);
  persist();
  return memory;
}

function persist() {
  if (!isBrowser() || !memory) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // ignore
  }
}

export function updateStore(mutator: (s: Store) => void) {
  const s = getStore();
  mutator(s);
  persist();
}

export function resetStore() {
  memory = structuredClone(defaults);
  persist();
}

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
}

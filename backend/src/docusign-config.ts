import fs from "node:fs";
import path from "node:path";

import { PROJECT_ROOT } from "./convention-data.js";

export type DocuSignSendMode = "template" | "document";

/** Clé RSA DocuSign à la racine du projet (`private.key`). */
export const DEFAULT_DOCUSIGN_PRIVATE_KEY_PATH = path.join(PROJECT_ROOT, "private.key");

function resolvePrivateKeyPath(): string | null {
  const fromEnv = process.env.DOCUSIGN_PRIVATE_KEY_PATH?.trim();
  const candidate = fromEnv
    ? path.isAbsolute(fromEnv)
      ? fromEnv
      : path.join(PROJECT_ROOT, fromEnv)
    : DEFAULT_DOCUSIGN_PRIVATE_KEY_PATH;
  return fs.existsSync(candidate) ? candidate : null;
}

export type DocuSignConfig = {
  integrationKey: string;
  userId: string;
  accountId: string;
  templateId: string;
  oauthHost: string;
  restApiFallback: string;
  privateKeyPath: string;
  roleStudent: string;
  roleCompany: string;
  sendMode: DocuSignSendMode;
};

const DEFAULT_ROLE_STUDENT = "Etudiant / Student";
const DEFAULT_ROLE_COMPANY = "Représentant de l'entreprise / Company Representative";

export function loadDocuSignConfig(): DocuSignConfig | null {
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY?.trim();
  const userId = process.env.DOCUSIGN_USER_ID?.trim();
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID?.trim();
  if (!integrationKey || !userId || !accountId) {
    return null;
  }

  const resolvedKey = resolvePrivateKeyPath();
  if (!resolvedKey) {
    return null;
  }

  const sendModeRaw = process.env.DOCUSIGN_SEND_MODE?.trim().toLowerCase();
  const sendMode: DocuSignSendMode = sendModeRaw === "document" ? "document" : "template";

  const templateId = process.env.DOCUSIGN_TEMPLATE_ID?.trim() ?? "";
  if (sendMode === "template" && !templateId) {
    return null;
  }

  return {
    integrationKey,
    userId,
    accountId,
    templateId,
    oauthHost: process.env.DOCUSIGN_OAUTH_HOST?.trim() || "account.docusign.com",
    restApiFallback:
      process.env.DOCUSIGN_RESTAPI_BASE_URI?.trim() || "https://eu.docusign.net/restapi",
    privateKeyPath: resolvedKey,
    roleStudent: process.env.DOCUSIGN_ROLE_STUDENT?.trim() || DEFAULT_ROLE_STUDENT,
    roleCompany: process.env.DOCUSIGN_ROLE_COMPANY?.trim() || DEFAULT_ROLE_COMPANY,
    sendMode,
  };
}

export function docuSignConsentUrl(integrationKey: string): string {
  const host = process.env.DOCUSIGN_OAUTH_HOST?.includes("account-d")
    ? "account-d.docusign.com"
    : "account.docusign.com";
  return (
    `https://${host}/oauth/auth?response_type=code&scope=signature%20impersonation` +
    `&client_id=${integrationKey}` +
    `&redirect_uri=https://developers.docusign.com/platform/auth/consent`
  );
}

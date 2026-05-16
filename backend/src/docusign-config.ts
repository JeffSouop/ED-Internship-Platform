import fs from "node:fs";
import path from "node:path";

export type DocuSignSendMode = "template" | "document";

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
  const privateKeyPath = process.env.DOCUSIGN_PRIVATE_KEY_PATH?.trim();

  if (!integrationKey || !userId || !accountId || !privateKeyPath) {
    return null;
  }

  const resolvedKey = path.resolve(privateKeyPath);
  if (!fs.existsSync(resolvedKey)) {
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

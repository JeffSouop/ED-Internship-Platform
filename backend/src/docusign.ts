import { resolveConventionAbsolutePath } from "./convention-index.js";

export const DOCUSIGN_NOT_CONFIGURED_CODE = "DOCUSIGN_NOT_CONFIGURED";

export type DocuSignConfigStatus = {
  configured: boolean;
  /** true si les variables d’environnement sont présentes (envoi pas encore implémenté). */
  ready: boolean;
};

export function getDocuSignConfigStatus(): DocuSignConfigStatus {
  const hasCredentials = Boolean(
    process.env.DOCUSIGN_INTEGRATION_KEY?.trim() &&
      process.env.DOCUSIGN_USER_ID?.trim() &&
      process.env.DOCUSIGN_ACCOUNT_ID?.trim() &&
      process.env.DOCUSIGN_BASE_PATH?.trim(),
  );
  return {
    configured: hasCredentials,
    ready: false,
  };
}

export class DocuSignError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    readonly code?: string,
  ) {
    super(message);
    this.name = "DocuSignError";
  }
}

export type DocuSignSendResult = {
  ok: true;
  studentId: string;
  envelopeId?: string;
  message: string;
};

/**
 * Envoie la convention générée vers DocuSign pour signature.
 * Phase 1 : contrôle de configuration + fichier local ; appel API DocuSign à brancher.
 */
export async function sendConventionToDocuSign(studentId: string): Promise<DocuSignSendResult> {
  const id = studentId.trim();
  if (!id) {
    throw new DocuSignError("studentId requis.", 400);
  }

  const resolved = resolveConventionAbsolutePath(id);
  if (!resolved) {
    throw new DocuSignError("Aucune convention enregistrée pour cet étudiant.", 404);
  }

  const status = getDocuSignConfigStatus();
  if (!status.configured) {
    throw new DocuSignError(
      "DocuSign n’est pas encore configuré sur le serveur (variables d’environnement).",
      503,
      DOCUSIGN_NOT_CONFIGURED_CODE,
    );
  }

  // TODO: authentification JWT DocuSign + création enveloppe + signataires
  throw new DocuSignError(
    "Les identifiants DocuSign sont présents mais l’envoi automatique n’est pas encore activé.",
    501,
    "DOCUSIGN_NOT_IMPLEMENTED",
  );
}

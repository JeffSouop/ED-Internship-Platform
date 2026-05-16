import type pg from "pg";

import {
  buildConventionTemplateData,
  loadConventionSourceRow,
} from "./convention-data.js";
import { resolveConventionAbsolutePath } from "./convention-index.js";
import { saveDocuSignSendRecord } from "./convention-tracking.js";
import {
  createDocuSignApiClient,
  sendEnvelopeWithCompositeTemplate,
  sendEnvelopeWithDocument,
  type DocuSignSigner,
} from "./docusign-client.js";
import {
  docuSignConsentUrl,
  loadDocuSignConfig,
  type DocuSignConfig,
} from "./docusign-config.js";

export const DOCUSIGN_NOT_CONFIGURED_CODE = "DOCUSIGN_NOT_CONFIGURED";

export type DocuSignConfigStatus = {
  configured: boolean;
  ready: boolean;
  sendMode?: "template" | "document";
};

export function getDocuSignConfigStatus(): DocuSignConfigStatus {
  const config = loadDocuSignConfig();
  if (!config) {
    return { configured: false, ready: false };
  }
  return {
    configured: true,
    ready: true,
    sendMode: config.sendMode,
  };
}

export class DocuSignError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    readonly code?: string,
    readonly consentUrl?: string,
  ) {
    super(message);
    this.name = "DocuSignError";
  }
}

export type DocuSignSendResult = {
  ok: true;
  studentId: string;
  envelopeId: string;
  message: string;
  sendMode: "template" | "document";
};

/** Objet e-mail DocuSign : [ECOLE DUCASSE] Internship contract E-signature Prénom Nom */
export function buildDocuSignEmailSubject(prenom: string, nom: string): string {
  const fullName = `${prenom.trim()} ${nom.trim()}`.trim();
  const suffix = fullName || "Student";
  return `[ECOLE DUCASSE] Internship contract E-signature ${suffix}`;
}

function buildSignersFromRow(row: Record<string, unknown>): {
  student: DocuSignSigner;
  companySigner: DocuSignSigner;
  companyLegalName: string;
  emailSubject: string;
} {
  const data = buildConventionTemplateData(row);

  const studentName =
    `${data.Prenoom_Etud} ${data.Nom_Etud}`.trim() || "Étudiant";
  const emailSubject = buildDocuSignEmailSubject(data.Prenoom_Etud, data.Nom_Etud);
  const studentEmail = data.Mail_etudiant.trim();
  if (!studentEmail) {
    throw new DocuSignError(
      "Adresse e-mail étudiant manquante — impossible d’envoyer la convention DocuSign.",
      422,
    );
  }

  const companyLegalName = data.Nom_entreprise.trim() || "—";
  const companySignerName =
    data.Representee_par.trim() ||
    data.Nom_tuteur.trim() ||
    companyLegalName ||
    "Représentant entreprise";
  const companyEmail =
    data.Courriel_entreprise.trim() || data.Mail_tuteur.trim();
  if (!companyEmail) {
    throw new DocuSignError(
      "Adresse e-mail entreprise / tuteur manquante — impossible d’envoyer la convention DocuSign.",
      422,
    );
  }

  return {
    student: { name: studentName, email: studentEmail },
    companySigner: { name: companySignerName, email: companyEmail },
    companyLegalName,
    emailSubject,
  };
}

function mapDocuSignApiError(err: unknown, config: DocuSignConfig | null): DocuSignError {
  const body =
    err && typeof err === "object" && "response" in err
      ? (err as { response?: { body?: { message?: string; errorCode?: string } } }).response
          ?.body
      : undefined;
  const message =
    body?.message ||
    (err instanceof Error ? err.message : "Erreur DocuSign");

  if (
    message.includes("consent") ||
    body?.errorCode === "CONSENT_REQUIRED"
  ) {
    const ik = config?.integrationKey ?? "";
    return new DocuSignError(
      "Consentement DocuSign requis pour cette application (première utilisation).",
      403,
      "DOCUSIGN_CONSENT_REQUIRED",
      ik ? docuSignConsentUrl(ik) : undefined,
    );
  }

  return new DocuSignError(message, 502, "DOCUSIGN_API_ERROR");
}

export async function sendConventionToDocuSign(
  pool: pg.Pool,
  studentId: string,
): Promise<DocuSignSendResult> {
  const id = studentId.trim();
  if (!id) {
    throw new DocuSignError("studentId requis.", 400);
  }

  const config = loadDocuSignConfig();
  if (!config) {
    throw new DocuSignError(
      "DocuSign n’est pas configuré (variables d’environnement ou clé privée introuvable).",
      503,
      DOCUSIGN_NOT_CONFIGURED_CODE,
    );
  }

  const resolved = resolveConventionAbsolutePath(id);
  if (!resolved) {
    throw new DocuSignError("Aucune convention enregistrée pour cet étudiant.", 404);
  }

  const row = await loadConventionSourceRow(pool, id);
  if (!row) {
    throw new DocuSignError("Données étudiant introuvables.", 404);
  }

  const { student, companySigner, companyLegalName, emailSubject } =
    buildSignersFromRow(row);

  try {
    const apiClient = await createDocuSignApiClient(config);
    let envelopeId: string;

    if (config.sendMode === "document") {
      envelopeId = await sendEnvelopeWithDocument(
        apiClient,
        config,
        resolved.absolutePath,
        resolved.entry.filename,
        student,
        companySigner,
        emailSubject,
      );
    } else {
      envelopeId = await sendEnvelopeWithCompositeTemplate(
        apiClient,
        config,
        resolved.absolutePath,
        resolved.entry.filename,
        student,
        companySigner,
        emailSubject,
      );
    }

    if (!envelopeId) {
      throw new DocuSignError("DocuSign n’a pas renvoyé d’identifiant d’enveloppe.", 502);
    }

    saveDocuSignSendRecord(
      id,
      envelopeId,
      emailSubject,
      student,
      companySigner,
      companyLegalName,
    );

    return {
      ok: true,
      studentId: id,
      envelopeId,
      message: "La convention a été envoyée pour signature via DocuSign.",
      sendMode: config.sendMode,
    };
  } catch (e) {
    if (e instanceof DocuSignError) throw e;
    throw mapDocuSignApiError(e, config);
  }
}

import fs from "node:fs";

import docusign from "docusign-esign";

import type { DocuSignConfig } from "./docusign-config.js";

type DocuSignApiClient = InstanceType<typeof docusign.ApiClient>;

export type DocuSignSigner = {
  name: string;
  email: string;
};

/** documentId du modèle DocuSign (requis pour remplacer le document tout en gardant les onglets). */
const templateDocumentIdCache = new Map<string, string>();

function oauthBasePath(host: string): string {
  return host.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export async function createDocuSignApiClient(
  config: DocuSignConfig,
): Promise<DocuSignApiClient> {
  const privateKeyBytes = fs.readFileSync(config.privateKeyPath);

  const oauthClient = new docusign.ApiClient();
  oauthClient.setOAuthBasePath(oauthBasePath(config.oauthHost));

  const tokenResponse = await oauthClient.requestJWTUserToken(
    config.integrationKey,
    config.userId,
    ["signature", "impersonation"],
    privateKeyBytes,
    3600,
  );

  const accessToken = tokenResponse.body.access_token;
  let basePath = config.restApiFallback;

  try {
    const userInfo = await oauthClient.getUserInfo(accessToken);
    const accounts = userInfo.accounts ?? [];
    const account =
      accounts.find(
        (a: { accountId?: string; baseUri?: string }) =>
          String(a.accountId) === String(config.accountId),
      ) ?? accounts[0];
    if (account?.baseUri) {
      basePath = `${account.baseUri}/restapi`;
    }
  } catch {
    /* utilise le fallback EU/production */
  }

  const apiClient = new docusign.ApiClient();
  apiClient.setBasePath(basePath);
  apiClient.addDefaultHeader("Authorization", `Bearer ${accessToken}`);
  return apiClient;
}

async function getTemplateDocumentId(
  apiClient: DocuSignApiClient,
  config: DocuSignConfig,
): Promise<string> {
  const cacheKey = `${config.accountId}:${config.templateId}`;
  const cached = templateDocumentIdCache.get(cacheKey);
  if (cached) return cached;

  const templatesApi = new docusign.TemplatesApi(apiClient);
  const result = await templatesApi.listDocuments(config.accountId, config.templateId);
  const documents = result.templateDocuments ?? [];
  if (documents.length === 0) {
    throw new Error("Le modèle DocuSign ne contient aucun document.");
  }

  const documentId = String(documents[0].documentId ?? "");
  if (!documentId) {
    throw new Error("Impossible de lire le documentId du modèle DocuSign.");
  }

  templateDocumentIdCache.set(cacheKey, documentId);
  return documentId;
}

/**
 * Envoie la convention .docx générée localement en réutilisant le modèle DocuSign
 * (emplacements de signature / onglets du server template).
 */
export async function sendEnvelopeWithCompositeTemplate(
  apiClient: DocuSignApiClient,
  config: DocuSignConfig,
  documentPath: string,
  documentName: string,
  student: DocuSignSigner,
  company: DocuSignSigner,
  emailSubject: string,
): Promise<string> {
  const templateDocumentId = await getTemplateDocumentId(apiClient, config);
  const fileBytes = fs.readFileSync(documentPath);

  const envelopeDefinition = {
    emailSubject,
    status: "sent",
    compositeTemplates: [
      {
        compositeTemplateId: "1",
        serverTemplates: [
          {
            sequence: "1",
            templateId: config.templateId,
          },
        ],
        inlineTemplates: [
          {
            sequence: "2",
            recipients: {
              signers: [
                {
                  roleName: config.roleStudent,
                  name: student.name,
                  email: student.email,
                  recipientId: "1",
                  routingOrder: "1",
                },
                {
                  roleName: config.roleCompany,
                  name: company.name,
                  email: company.email,
                  recipientId: "2",
                  routingOrder: "2",
                },
              ],
            },
          },
        ],
        document: {
          documentId: templateDocumentId,
          name: documentName,
          fileExtension: "docx",
          documentBase64: Buffer.from(fileBytes).toString("base64"),
        },
      },
    ],
  };

  const envelopesApi = new docusign.EnvelopesApi(apiClient);
  const result = await envelopesApi.createEnvelope(config.accountId, {
    envelopeDefinition,
  });
  return result.envelopeId ?? "";
}

/** Secours : positions de signature codées en dur (sans modèle DocuSign). */
export async function sendEnvelopeWithDocument(
  apiClient: DocuSignApiClient,
  config: DocuSignConfig,
  documentPath: string,
  documentName: string,
  student: DocuSignSigner,
  company: DocuSignSigner,
  emailSubject: string,
): Promise<string> {
  const fileBytes = fs.readFileSync(documentPath);
  const document = {
    documentBase64: Buffer.from(fileBytes).toString("base64"),
    name: documentName,
    fileExtension: "docx",
    documentId: "1",
  };

  const studentSign = docusign.SignHere.constructFromObject({
    documentId: "1",
    pageNumber: "1",
    recipientId: "1",
    tabLabel: "SignStudent",
    xPosition: "100",
    yPosition: "650",
  });

  const companySign = docusign.SignHere.constructFromObject({
    documentId: "1",
    pageNumber: "1",
    recipientId: "2",
    tabLabel: "SignCompany",
    xPosition: "350",
    yPosition: "650",
  });

  const studentSigner = docusign.Signer.constructFromObject({
    email: student.email,
    name: student.name,
    recipientId: "1",
    routingOrder: "1",
    tabs: docusign.Tabs.constructFromObject({ signHereTabs: [studentSign] }),
  });

  const companySigner = docusign.Signer.constructFromObject({
    email: company.email,
    name: company.name,
    recipientId: "2",
    routingOrder: "2",
    tabs: docusign.Tabs.constructFromObject({ signHereTabs: [companySign] }),
  });

  const envelopeDefinition = {
    emailSubject,
    documents: [document],
    recipients: docusign.Recipients.constructFromObject({
      signers: [studentSigner, companySigner],
    }),
    status: "sent",
  };

  const envelopesApi = new docusign.EnvelopesApi(apiClient);
  const result = await envelopesApi.createEnvelope(config.accountId, {
    envelopeDefinition,
  });
  return result.envelopeId ?? "";
}

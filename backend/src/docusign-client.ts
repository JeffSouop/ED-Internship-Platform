import fs from "node:fs";

import docusign from "docusign-esign";

import type { DocuSignConfig } from "./docusign-config.js";

type DocuSignApiClient = InstanceType<typeof docusign.ApiClient>;

export type DocuSignSigner = {
  name: string;
  email: string;
};

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

export async function sendEnvelopeFromTemplate(
  apiClient: DocuSignApiClient,
  config: DocuSignConfig,
  student: DocuSignSigner,
  company: DocuSignSigner,
  emailSubject: string,
): Promise<string> {
  const envelopeDefinition = new docusign.EnvelopeDefinition() as {
    emailSubject?: string;
    templateId?: string;
    status?: string;
    templateRoles?: unknown[];
  };
  envelopeDefinition.emailSubject = emailSubject;
  envelopeDefinition.templateId = config.templateId;
  envelopeDefinition.status = "sent";
  envelopeDefinition.templateRoles = [
    docusign.TemplateRole.constructFromObject({
      roleName: config.roleStudent,
      name: student.name,
      email: student.email,
    }),
    docusign.TemplateRole.constructFromObject({
      roleName: config.roleCompany,
      name: company.name,
      email: company.email,
    }),
  ];

  const envelopesApi = new docusign.EnvelopesApi(apiClient);
  const result = await envelopesApi.createEnvelope(config.accountId, {
    envelopeDefinition,
  });
  return result.envelopeId ?? "";
}

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

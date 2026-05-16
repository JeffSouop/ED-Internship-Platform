declare module "docusign-esign" {
  interface ModelClass {
    new (): Record<string, unknown>;
    constructFromObject(obj: Record<string, unknown>): unknown;
  }

  interface DocusignSdk {
    ApiClient: new () => {
      setOAuthBasePath(path: string): void;
      setBasePath(path: string): void;
      addDefaultHeader(name: string, value: string): void;
      requestJWTUserToken(
        clientId: string,
        userId: string,
        scopes: string[],
        privateKeyBytes: Buffer,
        expiresIn: number,
      ): Promise<{ body: { access_token: string } }>;
      getUserInfo(accessToken: string): Promise<{
        accounts?: Array<{ accountId?: string; baseUri?: string }>;
      }>;
    };
    EnvelopesApi: new (apiClient: InstanceType<DocusignSdk["ApiClient"]>) => {
      createEnvelope(
        accountId: string,
        opts: { envelopeDefinition: unknown },
      ): Promise<{ envelopeId?: string }>;
      getEnvelope(
        accountId: string,
        envelopeId: string,
      ): Promise<{ status?: string }>;
      listRecipients(
        accountId: string,
        envelopeId: string,
      ): Promise<{
        signers?: Array<{
          recipientId?: string;
          roleName?: string;
          name?: string;
          email?: string;
          status?: string;
        }>;
      }>;
    };
    TemplatesApi: new (apiClient: InstanceType<DocusignSdk["ApiClient"]>) => {
      listDocuments(
        accountId: string,
        templateId: string,
      ): Promise<{ templateDocuments?: Array<{ documentId?: string; name?: string }> }>;
    };
    EnvelopeDefinition: ModelClass;
    TemplateRole: ModelClass;
    Document: ModelClass;
    Signer: ModelClass;
    SignHere: ModelClass;
    Tabs: ModelClass;
    Recipients: ModelClass;
  }

  const docusign: DocusignSdk;
  export default docusign;
}

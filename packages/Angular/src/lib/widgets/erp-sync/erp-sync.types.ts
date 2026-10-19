export interface ERPConnectionCardModel {
  CompanyIntegrationID: string;
  CompanyID: string;
  CompanyName: string;
  IntegrationName: string;
  IsActive: boolean;
  LastRunStatus: string | null;
  LastRunAt: Date | null;
  LastError: string | null;
}

export interface ERPExtensionRowModel {
  ID: string;
  Code: string;
  Name: string;
  Description: string | null;
  Status: 'Active' | 'Disabled';
  Sequence: number;
  DriverClass: string;
  CompanyID: string | null;
}

export interface ERPSyncCompanyResultModel {
  CompanyID: string;
  CompanyIntegrationID: string | null;
  ProviderName: string | null;
  Success: boolean;
  Message: string;
}

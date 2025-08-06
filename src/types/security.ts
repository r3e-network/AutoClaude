/**
 * Type definitions for Security Agent
 */

// Vulnerability types
export interface Vulnerability {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location: string;
  cve?: string;
  cvss?: number;
  fix?: string;
  category?: string;
  priority?: number;
  scanType?: string;
}

// Audit types
export interface SecurityAuditResult {
  overallScore: number;
  vulnerabilities: Vulnerability[];
  categories: {
    authentication: number;
    authorization: number;
    cryptography: number;
    dataProtection: number;
    errorHandling: number;
    logging: number;
  };
  timestamp: Date;
}

// Recommendation types
export interface SecurityRecommendation {
  vulnerability: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  estimatedEffort: string;
  implementation: string;
}

export interface SecurityFixSuggestion {
  vulnerability: string;
  fix?: string;
  priority?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  automated?: boolean;
  fixCode?: string;
  targetFile?: string;
  description?: string;
}

// Scan result types
export interface ScanResult {
  scanType: string;
  vulnerabilities: Vulnerability[];
  scanTime: number;
  scannedFiles?: number;
  scannedLines?: number;
}

// Architecture types
export interface SystemArchitecture {
  components: ArchitectureComponent[];
  trustBoundaries: TrustBoundary[];
  dataFlows: DataFlow[];
}

export interface ArchitectureComponent {
  name: string;
  type: string;
  interfaces: string[];
  trustLevel: number;
}

export interface TrustBoundary {
  name: string;
  components: string[];
  level: number;
}

export interface DataFlow {
  from: string;
  to: string;
  data: string;
  protocol: string;
}

// Threat modeling types
export interface Threat {
  id: string;
  name: string;
  type: string;
  vector: string;
  category: string;
  likelihood?: string;
  impact?: string;
  risk?: string;
  affectedComponents: string[];
  description: string;
}

export interface RiskAssessment {
  [threatId: string]: {
    threat: string;
    likelihood: string;
    impact: string;
    risk: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface Mitigation {
  threatId: string;
  threat: string;
  mitigation: string;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  implementation: string;
  estimatedEffort: string;
}

// Hardening types
export interface HardeningCheck {
  area: string;
  check: string;
  status: 'pass' | 'fail' | 'warning';
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation?: string;
}

export interface HardeningStep {
  area: string;
  step: string;
  priority: 'high' | 'medium' | 'low';
  config: string;
  command?: string;
  configFile?: string;
}

export interface HardeningConfig {
  checks: HardeningCheck[];
  environment: string;
  timestamp: Date;
}

// Compliance types
export interface ComplianceCheck {
  framework: string;
  version: string;
  checks: ComplianceCheckItem[];
  timestamp: Date;
}

export interface ComplianceCheckItem {
  id: string;
  name: string;
  category: string;
  status: 'pass' | 'fail' | 'not_applicable';
  evidence?: string;
  recommendation?: string;
}

export interface ComplianceGap {
  checkId: string;
  name: string;
  category: string;
  gap: string;
  remediation: string;
}

// Penetration test types
export interface PenTestResult {
  test: string;
  target: string;
  result: 'vulnerable' | 'secure' | 'inconclusive';
  details: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  evidence?: string;
}

export interface PenTestFinding {
  test: string;
  target: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details: string;
  evidence?: string;
  remediation: string;
}

// Generic security types
export interface SecurityAnalysis {
  issues: SecurityIssue[];
  recommendations: string[];
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location?: string;
}
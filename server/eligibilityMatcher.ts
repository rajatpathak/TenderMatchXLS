import type { CompanyCriteria, InsertTender } from "@shared/schema";

export interface MatchResult {
  matchPercentage: number;
  isMsmeExempted: boolean;
  isStartupExempted: boolean;
  tags: string[];
  analysisStatus: "analyzed" | "unable_to_analyze";
}

const PROJECT_TYPE_KEYWORDS: Record<string, string[]> = {
  'Software': ['software', 'application', 'app development', 'programming', 'coding', 'erp', 'crm', 'portal'],
  'Website': ['website', 'web portal', 'web development', 'web application', 'web design', 'wordpress', 'e-commerce', 'ecommerce'],
  'Mobile': ['mobile', 'android', 'ios', 'app', 'smartphone', 'tablet'],
  'IT Projects': ['it project', 'information technology', 'ict', 'digitization', 'digital', 'automation', 'computerization'],
  'Manpower Deployment': ['manpower', 'staff', 'personnel', 'resource', 'outsourcing', 'deployment', 'hiring', 'recruitment', 'human resource'],
  'Consulting': ['consulting', 'consultancy', 'advisory', 'audit', 'assessment'],
  'Maintenance': ['maintenance', 'amc', 'annual maintenance', 'support', 'operation'],
  'Cloud Services': ['cloud', 'aws', 'azure', 'hosting', 'server', 'datacenter', 'data center'],
  'Data Analytics': ['data', 'analytics', 'bi', 'business intelligence', 'dashboard', 'reporting', 'ml', 'machine learning', 'ai', 'artificial intelligence'],
  'Cybersecurity': ['security', 'cyber', 'firewall', 'encryption', 'ssl', 'audit', 'vapt', 'penetration'],
};

const MSME_KEYWORDS = [
  'msme', 'micro', 'small', 'medium', 'enterprise', 
  'exempted for msme', 'msme exempted', 'relaxation for msme',
  'msme relaxation', 'waiver for msme', 'exemption for msme',
  'prior turnover exempted', 'turnover exempted',
  'turnover criteria relaxed', 'turnover not applicable'
];

const STARTUP_KEYWORDS = [
  'startup', 'start-up', 'start up', 'startups',
  'exempted for startup', 'startup exempted', 'relaxation for startup',
  'startup relaxation', 'dpiit', 'recognized startup'
];

const TURNOVER_PATTERN = /(?:turnover|annual turnover|avg\.\s*turnover|average turnover)[:\s]*(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?|lakh|lac|l)/gi;
const TURNOVER_CR_PATTERN = /(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?)/gi;
const TURNOVER_LAKH_PATTERN = /(\d+(?:\.\d+)?)\s*(?:lakh|lac|l)/gi;

function extractTurnoverRequirement(text: string): number | null {
  if (!text) return null;
  
  const lowerText = text.toLowerCase();
  
  // Look for crore amounts first
  const crMatches = [...lowerText.matchAll(/(?:turnover|annual turnover)[:\s]*(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?)/gi)];
  if (crMatches.length > 0) {
    return parseFloat(crMatches[0][1]);
  }
  
  // Look for lakh amounts
  const lakhMatches = [...lowerText.matchAll(/(?:turnover|annual turnover)[:\s]*(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:lakh|lac|l)/gi)];
  if (lakhMatches.length > 0) {
    return parseFloat(lakhMatches[0][1]) / 100; // Convert to crore
  }
  
  // Generic pattern
  const genericMatches = [...lowerText.matchAll(/(?:minimum|min\.?|avg\.?)?\s*(?:annual)?\s*turnover[:\s]*(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:cr|crore|lakh|lac|l)?/gi)];
  if (genericMatches.length > 0) {
    const match = genericMatches[0];
    const amount = parseFloat(match[1]);
    const unit = match[0].toLowerCase();
    if (unit.includes('lakh') || unit.includes('lac') || unit.includes(' l')) {
      return amount / 100;
    }
    if (unit.includes('cr') || amount < 100) {
      return amount;
    }
    return amount / 100; // Assume lakh if large number
  }
  
  return null;
}

function detectTags(text: string, criteria: CompanyCriteria): string[] {
  if (!text) return [];
  
  const lowerText = text.toLowerCase();
  const detectedTags: string[] = [];
  const companyTypes = criteria.projectTypes || [];
  
  for (const [tag, keywords] of Object.entries(PROJECT_TYPE_KEYWORDS)) {
    if (companyTypes.includes(tag)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          if (!detectedTags.includes(tag)) {
            detectedTags.push(tag);
          }
          break;
        }
      }
    }
  }
  
  return detectedTags;
}

function checkMsmeExemption(text: string): boolean {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  
  return MSME_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

function checkStartupExemption(text: string): boolean {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  
  return STARTUP_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

export function analyzeEligibility(
  tender: Partial<InsertTender>,
  criteria: CompanyCriteria
): MatchResult {
  const eligibilityText = [
    tender.eligibilityCriteria || '',
    tender.checklist || '',
    tender.title || '',
  ].join(' ');
  
  if (!eligibilityText.trim()) {
    return {
      matchPercentage: 0,
      isMsmeExempted: false,
      isStartupExempted: false,
      tags: [],
      analysisStatus: "unable_to_analyze",
    };
  }
  
  // Check for MSME/Startup exemptions
  const isMsmeExempted = checkMsmeExemption(eligibilityText);
  const isStartupExempted = checkStartupExemption(eligibilityText);
  
  // Detect tags based on project type keywords
  const tags = detectTags(eligibilityText, criteria);
  
  // Calculate match percentage
  let matchScore = 0;
  let totalCriteria = 0;
  
  // 1. Check turnover requirement (40% weight)
  const requiredTurnover = extractTurnoverRequirement(eligibilityText);
  const companyTurnover = parseFloat(criteria.turnoverCr || "4");
  
  totalCriteria += 40;
  if (isMsmeExempted || isStartupExempted) {
    matchScore += 40; // Full score if exempted
  } else if (requiredTurnover === null) {
    matchScore += 30; // Partial score if no requirement found
  } else if (companyTurnover >= requiredTurnover) {
    matchScore += 40; // Full score if meets requirement
  } else {
    // Partial score based on how close they are
    const ratio = companyTurnover / requiredTurnover;
    matchScore += Math.floor(40 * ratio);
  }
  
  // 2. Check project type match (40% weight)
  totalCriteria += 40;
  if (tags.length > 0) {
    matchScore += 40; // Full score if at least one tag matches
  } else {
    // Check if the tender seems to be in a completely different domain
    const textLower = eligibilityText.toLowerCase();
    const hasITKeywords = [
      'software', 'it', 'technology', 'digital', 'computer', 'web', 'mobile', 
      'application', 'development', 'system', 'portal', 'manpower', 'staff'
    ].some(kw => textLower.includes(kw));
    
    if (hasITKeywords) {
      matchScore += 20; // Partial score for related but not exact match
    }
  }
  
  // 3. Check for negative criteria - construction, civil works etc (20% weight)
  totalCriteria += 20;
  const negativeKeywords = ['civil', 'construction', 'building', 'road', 'bridge', 'infrastructure', 'medical', 'pharmaceutical'];
  const hasNegative = negativeKeywords.some(kw => eligibilityText.toLowerCase().includes(kw));
  
  if (!hasNegative) {
    matchScore += 20;
  }
  
  // Calculate final percentage
  let matchPercentage = Math.round((matchScore / totalCriteria) * 100);
  
  // If MSME/Startup exempted, boost to 100%
  if (isMsmeExempted || isStartupExempted) {
    matchPercentage = 100;
  }
  
  // Ensure percentage is within bounds
  matchPercentage = Math.max(0, Math.min(100, matchPercentage));
  
  return {
    matchPercentage,
    isMsmeExempted,
    isStartupExempted,
    tags,
    analysisStatus: "analyzed",
  };
}

export function detectCorrigendumChanges(
  originalTender: any,
  newTender: any
): { fieldName: string; oldValue: string; newValue: string }[] {
  const fieldsToCompare = [
    'title',
    'department',
    'organization',
    'estimatedValue',
    'emdAmount',
    'turnoverRequirement',
    'submissionDeadline',
    'openingDate',
    'eligibilityCriteria',
    'checklist',
  ];
  
  const changes: { fieldName: string; oldValue: string; newValue: string }[] = [];
  
  for (const field of fieldsToCompare) {
    const oldVal = originalTender[field];
    const newVal = newTender[field];
    
    const oldStr = oldVal === null || oldVal === undefined ? '' : String(oldVal);
    const newStr = newVal === null || newVal === undefined ? '' : String(newVal);
    
    if (oldStr !== newStr) {
      changes.push({
        fieldName: field,
        oldValue: oldStr,
        newValue: newStr,
      });
    }
  }
  
  return changes;
}

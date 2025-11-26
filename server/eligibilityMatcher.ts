import type { CompanyCriteria, InsertTender, NegativeKeyword } from "@shared/schema";

export type EligibilityStatus = "eligible" | "not_eligible" | "not_relevant" | "manual_review";

export interface MatchResult {
  matchPercentage: number;
  isMsmeExempted: boolean;
  isStartupExempted: boolean;
  tags: string[];
  analysisStatus: "analyzed" | "unable_to_analyze" | "not_eligible";
  eligibilityStatus: EligibilityStatus;
  notRelevantKeyword: string | null;
  turnoverRequired: number | null;
  turnoverMet: boolean;
}

const PROJECT_TYPE_KEYWORDS: Record<string, string[]> = {
  'Software': ['software', 'application', 'app development', 'programming', 'coding', 'erp', 'crm', 'portal'],
  'Website': ['website', 'web portal', 'web development', 'web application', 'web design', 'wordpress', 'e-commerce', 'ecommerce'],
  'Mobile': ['mobile', 'android', 'ios', 'app', 'smartphone', 'tablet'],
  'IT Projects': ['it project', 'information technology', 'ict', 'digitization', 'digital', 'automation', 'computerization', 'ites', 'it/ites', 'it services'],
  'Manpower Deployment': ['manpower', 'staff', 'personnel', 'resource', 'outsourcing', 'deployment', 'hiring', 'recruitment', 'human resource'],
  'Consulting': ['consulting', 'consultancy', 'advisory', 'audit', 'assessment'],
  'Maintenance': ['maintenance', 'amc', 'annual maintenance', 'support', 'operation'],
  'Cloud Services': ['cloud', 'aws', 'azure', 'hosting', 'server', 'datacenter', 'data center'],
  'Data Analytics': ['data', 'analytics', 'bi', 'business intelligence', 'dashboard', 'reporting', 'ml', 'machine learning', 'ai', 'artificial intelligence'],
  'Cybersecurity': ['security', 'cyber', 'firewall', 'encryption', 'ssl', 'audit', 'vapt', 'penetration'],
};

// More specific MSME exemption patterns - must be explicit exemption statements
const MSME_EXEMPTION_PATTERNS = [
  /msme\s*(are|is)?\s*exempt(ed)?/i,
  /exempt(ed|ion)?\s*(for|to)?\s*msme/i,
  /relaxation\s*(for|to)?\s*msme/i,
  /msme\s*relaxation/i,
  /waiver\s*(for|to)?\s*msme/i,
  /turnover\s*(requirement|criteria)?\s*(is\s*)?(exempt(ed)?|waived|relaxed|not\s*applicable)\s*(for|to)?\s*msme/i,
  /prior\s*turnover\s*(is\s*)?(exempt(ed)?|waived|not\s*required)/i,
  /turnover\s*criteria\s*(is\s*)?(relaxed|waived|exempted)/i,
];

const STARTUP_EXEMPTION_PATTERNS = [
  /startup(s)?\s*(are|is)?\s*exempt(ed)?/i,
  /exempt(ed|ion)?\s*(for|to)?\s*startup/i,
  /relaxation\s*(for|to)?\s*startup/i,
  /startup\s*relaxation/i,
  /dpiit\s*registered\s*startup/i,
  /recognized\s*startup/i,
  /turnover\s*(requirement|criteria)?\s*(is\s*)?(exempt(ed)?|waived|relaxed|not\s*applicable)\s*(for|to)?\s*startup/i,
];

// Patterns that indicate NO exemption is allowed
const NO_EXEMPTION_PATTERNS = [
  /no\s*exemption/i,
  /exemption\s*not\s*allowed/i,
  /exemption\s*not\s*applicable/i,
  /no\s*relaxation/i,
  /relaxation\s*not\s*allowed/i,
  /mandatory\s*requirement/i,
  /strictly\s*required/i,
];

function extractTurnoverRequirement(text: string): number | null {
  if (!text) return null;
  
  const lowerText = text.toLowerCase();
  
  // Multiple patterns to catch various turnover formats
  const patterns = [
    // "Rs.10 Crores" or "Rs. 10 Crore" or "Rs 10 Crores"
    /rs\.?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)/gi,
    // "10 Crore" or "10 Crores" with context
    /(?:at\s*least|minimum|min\.?|should\s*be)\s*(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)/gi,
    // "turnover ... Rs.10 Crores"
    /turnover[^.]*?(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)/gi,
    // "average annual turnover ... should be at least Rs.10 Crores"
    /(?:average\s*)?(?:annual\s*)?turnover[^.]*?(?:at\s*least\s*)?(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)/gi,
    // "INR 10 Crore"
    /inr\.?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)/gi,
    // Fallback: number followed by crore/crores
    /(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      const amount = parseFloat(matches[0][1]);
      if (amount > 0 && amount < 10000) { // Reasonable range for crores
        return amount;
      }
    }
  }
  
  // Check for lakh amounts
  const lakhPatterns = [
    /rs\.?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac|l(?:acs)?)/gi,
    /(?:at\s*least|minimum)\s*(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:lakh|lac|l(?:acs)?)/gi,
    /turnover[^.]*?(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:lakh|lac|l(?:acs)?)/gi,
  ];
  
  for (const pattern of lakhPatterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      const amount = parseFloat(matches[0][1]);
      if (amount > 0) {
        return amount / 100; // Convert lakhs to crores
      }
    }
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
  
  // First check if exemption is explicitly denied
  for (const pattern of NO_EXEMPTION_PATTERNS) {
    if (pattern.test(text)) {
      return false;
    }
  }
  
  // Then check for explicit MSME exemption patterns
  for (const pattern of MSME_EXEMPTION_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

function checkStartupExemption(text: string): boolean {
  if (!text) return false;
  
  // First check if exemption is explicitly denied
  for (const pattern of NO_EXEMPTION_PATTERNS) {
    if (pattern.test(text)) {
      return false;
    }
  }
  
  // Then check for explicit startup exemption patterns
  for (const pattern of STARTUP_EXEMPTION_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

// Check if tender matches any negative keywords
function checkNegativeKeywords(text: string, negativeKeywords: NegativeKeyword[]): string | null {
  if (!text || negativeKeywords.length === 0) return null;
  
  const lowerText = text.toLowerCase();
  
  for (const kw of negativeKeywords) {
    const keyword = kw.keyword.toLowerCase();
    if (lowerText.includes(keyword)) {
      return kw.keyword; // Return the matched keyword
    }
  }
  
  return null;
}

export function analyzeEligibility(
  tender: Partial<InsertTender>,
  criteria: CompanyCriteria,
  negativeKeywords: NegativeKeyword[] = [],
  excelMsmeExemption: boolean = false,
  excelStartupExemption: boolean = false
): MatchResult {
  const eligibilityText = [
    tender.eligibilityCriteria || '',
    tender.checklist || '',
    tender.title || '',
  ].join(' ');
  
  // Check for negative keywords first (mark as not relevant)
  const matchedNegativeKeyword = checkNegativeKeywords(eligibilityText, negativeKeywords);
  if (matchedNegativeKeyword) {
    return {
      matchPercentage: 0,
      isMsmeExempted: false,
      isStartupExempted: false,
      tags: [],
      analysisStatus: "analyzed",
      eligibilityStatus: "not_relevant",
      notRelevantKeyword: matchedNegativeKeyword,
      turnoverRequired: null,
      turnoverMet: false,
    };
  }
  
  if (!eligibilityText.trim()) {
    return {
      matchPercentage: 0,
      isMsmeExempted: excelMsmeExemption,
      isStartupExempted: excelStartupExemption,
      tags: [],
      analysisStatus: "unable_to_analyze",
      eligibilityStatus: "manual_review",
      notRelevantKeyword: null,
      turnoverRequired: null,
      turnoverMet: false,
    };
  }
  
  // Use Excel exemption if provided, otherwise check from text
  // Excel column values take precedence since they are explicit
  const isMsmeExempted = excelMsmeExemption || checkMsmeExemption(eligibilityText);
  const isStartupExempted = excelStartupExemption || checkStartupExemption(eligibilityText);
  
  // Detect tags based on project type keywords
  const tags = detectTags(eligibilityText, criteria);
  
  // Extract turnover requirement
  const requiredTurnover = extractTurnoverRequirement(eligibilityText);
  const companyTurnover = parseFloat(criteria.turnoverCr || "4");
  
  // Determine if turnover requirement is met
  let turnoverMet = true;
  if (requiredTurnover !== null) {
    if (isMsmeExempted || isStartupExempted) {
      turnoverMet = true; // Exempted
    } else if (companyTurnover >= requiredTurnover) {
      turnoverMet = true;
    } else {
      turnoverMet = false; // NOT ELIGIBLE - company doesn't meet turnover requirement
    }
  }
  
  // Calculate match percentage
  let matchScore = 0;
  let totalCriteria = 0;
  
  // 1. Check turnover requirement (50% weight - most important)
  totalCriteria += 50;
  if (isMsmeExempted || isStartupExempted) {
    matchScore += 50; // Full score if exempted
  } else if (requiredTurnover === null) {
    matchScore += 40; // Good score if no explicit requirement found
  } else if (companyTurnover >= requiredTurnover) {
    matchScore += 50; // Full score if meets requirement
  } else {
    // Zero score if turnover requirement is not met - this is critical
    matchScore += 0;
  }
  
  // 2. Check project type match (30% weight)
  totalCriteria += 30;
  if (tags.length > 0) {
    matchScore += 30; // Full score if at least one tag matches
  } else {
    // Check if the tender seems to be in a related domain
    const textLower = eligibilityText.toLowerCase();
    const hasITKeywords = [
      'software', 'it', 'technology', 'digital', 'computer', 'web', 'mobile', 
      'application', 'development', 'system', 'portal', 'manpower', 'staff',
      'ites', 'it/ites', 'it services'
    ].some(kw => textLower.includes(kw));
    
    if (hasITKeywords) {
      matchScore += 15; // Partial score for related but not exact match
    }
  }
  
  // 3. Check for negative criteria - construction, civil works etc (20% weight)
  totalCriteria += 20;
  const hardcodedNegativeWords = ['civil', 'construction', 'building', 'road', 'bridge', 'infrastructure', 'medical', 'pharmaceutical', 'electrical', 'mechanical'];
  const hasNegative = hardcodedNegativeWords.some(kw => eligibilityText.toLowerCase().includes(kw));
  
  if (!hasNegative) {
    matchScore += 20;
  }
  
  // Calculate final percentage
  let matchPercentage = Math.round((matchScore / totalCriteria) * 100);
  
  // If MSME/Startup exempted and all other criteria met, can go to 100%
  if ((isMsmeExempted || isStartupExempted) && tags.length > 0 && !hasNegative) {
    matchPercentage = 100;
  }
  
  // Ensure percentage is within bounds
  matchPercentage = Math.max(0, Math.min(100, matchPercentage));
  
  // Determine analysis status and eligibility status
  let analysisStatus: "analyzed" | "unable_to_analyze" | "not_eligible" = "analyzed";
  let eligibilityStatus: EligibilityStatus = "eligible";
  
  // If turnover requirement exists and company doesn't meet it (and no exemption), mark as NOT ELIGIBLE
  if (!turnoverMet && requiredTurnover !== null) {
    analysisStatus = "not_eligible";
    eligibilityStatus = "not_eligible";
    matchPercentage = Math.min(matchPercentage, 40); // Cap at 40% for not eligible
  }
  
  return {
    matchPercentage,
    isMsmeExempted,
    isStartupExempted,
    tags,
    analysisStatus,
    eligibilityStatus,
    notRelevantKeyword: null,
    turnoverRequired: requiredTurnover,
    turnoverMet,
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

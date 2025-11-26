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

// Core service keywords from GEM Column X (Similar Category)
// These are our primary services - if matched with turnover = 100% match
const CORE_SERVICE_KEYWORDS = [
  'manpower',
  'software',
  'hiring of agency for it projects',
  'it projects',
  'milestone basis',
  'custom bid for services',
  'custom bid',
  'it services',
  'ites',
  'it/ites',
  'website',
  'web development',
  'web portal',
  'web application',
  'mobile',
  'mobile app',
  'app development',
  'application development',
  'portal development',
  'digital',
  'digitization',
  'computerization',
  'automation',
  'erp',
  'crm',
  'information technology',
  'ict',
];

function checkCoreServiceMatch(similarCategory: string | null | undefined): boolean {
  if (!similarCategory) return false;
  const lowerCategory = similarCategory.toLowerCase();
  return CORE_SERVICE_KEYWORDS.some(keyword => lowerCategory.includes(keyword));
}

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
  
  // Check for lakh amounts first (return value in Lakhs)
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
        return amount; // Keep in Lakhs - don't convert
      }
    }
  }
  
  // Check for crore amounts (convert to Lakhs: 1 Crore = 100 Lakhs)
  const crorePatterns = [
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
  
  for (const pattern of crorePatterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      const amount = parseFloat(matches[0][1]);
      if (amount > 0 && amount < 10000) { // Reasonable range for crores
        return amount * 100; // Convert Crores to Lakhs (1 Crore = 100 Lakhs)
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

// Get ALL negative keywords that match, not just the first one
function checkAllNegativeKeywords(text: string, negativeKeywords: NegativeKeyword[]): string[] {
  if (!text || negativeKeywords.length === 0) return [];
  
  const lowerText = text.toLowerCase();
  const matched: string[] = [];
  
  for (const kw of negativeKeywords) {
    const keyword = kw.keyword.toLowerCase();
    if (lowerText.includes(keyword)) {
      matched.push(kw.keyword);
    }
  }
  
  return matched;
}

// Check if tender is primarily about IT/Software SERVICES (not just contains IT keywords)
// This is stricter - looks for service-oriented terms, not just IT product mentions
function isPrimaryITServiceTender(title: string, eligibilityText: string): boolean {
  const lowerTitle = title.toLowerCase();
  const lowerText = eligibilityText.toLowerCase();
  
  // FIRST CHECK: If title starts with procurement/supply terms, it's NOT an IT service tender
  // These are about BUYING products, not providing services
  const procurementStarts = [
    'supply of', 'procurement of', 'purchase of', 'buying of',
    'rate contract for supply', 'supply and installation',
    'providing and supplying', 'supply, installation'
  ];
  
  const isProcurementTender = procurementStarts.some(term => lowerTitle.includes(term));
  
  // If it's a procurement tender, it's NOT an IT service tender - regardless of other keywords
  if (isProcurementTender) {
    return false;
  }
  
  // Strong IT SERVICE indicators - must be about providing services, not buying products
  const serviceVerbs = [
    'development', 'deployment', 'implementation', 'integration', 
    'design and development', 'customization', 'configuration',
    'maintenance', 'support services', 'consulting', 'consultancy',
    'hiring of agency', 'outsourcing', 'manpower supply', 'staffing',
    'amc', 'annual maintenance contract', 'operation and maintenance',
    'creation of', 'building of', 'setting up'
  ];
  
  // Check if title contains service verbs (strong indicator)
  const hasTitleServiceVerb = serviceVerbs.some(verb => lowerTitle.includes(verb));
  
  // Check eligibility text for service-oriented content
  const hasTextServiceVerb = serviceVerbs.some(verb => lowerText.includes(verb));
  
  // If title explicitly mentions software/website/app DEVELOPMENT/SERVICES, it's IT service
  if (hasTitleServiceVerb && (
    lowerTitle.includes('software') || 
    lowerTitle.includes('website') || 
    lowerTitle.includes('web portal') ||
    lowerTitle.includes('mobile app') ||
    lowerTitle.includes('application')
  )) {
    return true;
  }
  
  // If it's about hiring agency for IT projects
  if (lowerTitle.includes('hiring') && (lowerTitle.includes('it') || lowerTitle.includes('software'))) {
    return true;
  }
  
  // If title contains IT service keywords AND service verbs in text
  if (hasTextServiceVerb && (
    lowerTitle.includes('it project') ||
    lowerTitle.includes('it/ites') ||
    lowerTitle.includes('software services') ||
    lowerTitle.includes('it services')
  )) {
    return true;
  }
  
  return false;
}

// Check if negative keyword is the PRIMARY focus of the tender (appears prominently in title)
function isNegativeKeywordPrimaryFocus(title: string, negativeKeyword: string): boolean {
  const lowerTitle = title.toLowerCase();
  const lowerKeyword = negativeKeyword.toLowerCase();
  
  // If the negative keyword appears in the title, it's likely the primary focus
  if (lowerTitle.includes(lowerKeyword)) {
    return true;
  }
  
  // Check for related procurement terms that indicate buying products (not services)
  const procurementTerms = [
    'supply of', 'procurement of', 'purchase of', 'buying', 
    'installation of', 'providing', 'supply and installation',
    'rate contract for', 'empanelment for supply'
  ];
  
  // If title has procurement terms + equipment-related words, it's about buying stuff
  const hasProcurementTerm = procurementTerms.some(term => lowerTitle.includes(term));
  const equipmentRelated = ['equipment', 'hardware', 'machine', 'device', 'instrument', 'furniture', 'class room', 'classroom', 'lab', 'laboratory'].some(eq => lowerTitle.includes(eq));
  
  if (hasProcurementTerm && equipmentRelated) {
    return true;
  }
  
  return false;
}

export function analyzeEligibility(
  tender: Partial<InsertTender>,
  criteria: CompanyCriteria,
  negativeKeywords: NegativeKeyword[] = [],
  excelMsmeExemption: boolean = false,
  excelStartupExemption: boolean = false,
  similarCategory: string | null = null
): MatchResult {
  const eligibilityText = [
    tender.eligibilityCriteria || '',
    tender.checklist || '',
    tender.title || '',
  ].join(' ');
  
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
  const isMsmeExempted = excelMsmeExemption || checkMsmeExemption(eligibilityText);
  const isStartupExempted = excelStartupExemption || checkStartupExemption(eligibilityText);
  
  // Detect tags based on project type keywords
  const tags = detectTags(eligibilityText, criteria);
  
  // Check if tender matches core IT/Software services (from title or Similar Category)
  const isCoreServiceMatch = checkCoreServiceMatch(similarCategory);
  const textLower = eligibilityText.toLowerCase();
  const titleText = tender.title || '';
  
  // Check for negative keywords - get ALL matches, not just the first one
  const allMatchedKeywords = checkAllNegativeKeywords(eligibilityText, negativeKeywords);
  
  // SMART NEGATIVE KEYWORD CHECK:
  // Priority: If ANY negative keyword appears in TITLE, it's likely the PRIMARY focus
  // Exception: If the tender is clearly about IT SERVICES (development, deployment, etc.)
  if (allMatchedKeywords.length > 0) {
    const isITServiceTender = isPrimaryITServiceTender(titleText, eligibilityText);
    
    // Check if ANY matched keyword appears in the title
    let keywordInTitle: string | null = null;
    for (const kw of allMatchedKeywords) {
      if (isNegativeKeywordPrimaryFocus(titleText, kw)) {
        keywordInTitle = kw;
        break;
      }
    }
    
    // If a negative keyword is in the title AND it's not primarily an IT service tender
    // Mark as not_relevant
    if (keywordInTitle && !isITServiceTender) {
      return {
        matchPercentage: 0,
        isMsmeExempted: false,
        isStartupExempted: false,
        tags: [],
        analysisStatus: "analyzed",
        eligibilityStatus: "not_relevant",
        notRelevantKeyword: keywordInTitle,
        turnoverRequired: null,
        turnoverMet: false,
      };
    }
    
    // If no negative keyword is in the title, check if it's a non-IT tender
    // If non-IT, mark as not_relevant (the negative keyword in criteria text is disqualifying)
    const hasCoreITKeywords = [
      'software', 'website', 'web portal', 'web application', 'web development',
      'mobile app', 'app development', 'application development', 'it project',
      'it/ites', 'ites', 'it services', 'digitization', 'portal',
      'manpower', 'erp', 'crm', 'data processing', 'solution design',
      'computerization', 'automation', 'information technology', 'ict'
    ].some(kw => textLower.includes(kw));
    
    const matchesCoreProjectTypes = tags.length > 0 || isCoreServiceMatch || hasCoreITKeywords;
    
    if (!matchesCoreProjectTypes) {
      return {
        matchPercentage: 0,
        isMsmeExempted: false,
        isStartupExempted: false,
        tags: [],
        analysisStatus: "analyzed",
        eligibilityStatus: "not_relevant",
        notRelevantKeyword: allMatchedKeywords[0],
        turnoverRequired: null,
        turnoverMet: false,
      };
    }
  }
  
  // Continue with IT keyword detection for scoring
  const hasCoreITKeywords = [
    'software', 'website', 'web portal', 'web application', 'web development',
    'mobile app', 'app development', 'application development', 'it project',
    'it/ites', 'ites', 'it services', 'digitization', 'digital', 'portal',
    'manpower', 'erp', 'crm', 'data processing', 'solution design',
    'computerization', 'automation', 'information technology', 'ict'
  ].some(kw => textLower.includes(kw));
  
  const matchesCoreProjectTypes = tags.length > 0 || isCoreServiceMatch || hasCoreITKeywords;
  
  // Extract turnover requirement in LAKHS
  // Excel value (from Column S) is already in Lakhs, text parsing also returns Lakhs
  const excelTurnover = tender.turnoverRequirement ? parseFloat(String(tender.turnoverRequirement)) : null;
  const textTurnover = extractTurnoverRequirement(eligibilityText);
  const requiredTurnoverLakhs = excelTurnover !== null && !isNaN(excelTurnover) ? excelTurnover : textTurnover;
  // Company turnover: criteria.turnoverCr is in Crores, convert to Lakhs (or use 400 Lakhs as default = 4 Crore)
  const companyTurnoverLakhs = parseFloat(criteria.turnoverCr || "4") * 100; // 4 Crore = 400 Lakhs
  
  // Determine if turnover requirement is met (all values in LAKHS)
  let turnoverMet = true;
  if (requiredTurnoverLakhs !== null && requiredTurnoverLakhs > 0) {
    if (isMsmeExempted || isStartupExempted) {
      turnoverMet = true; // Exempted
    } else if (companyTurnoverLakhs >= requiredTurnoverLakhs) {
      turnoverMet = true; // Company meets requirement (e.g., 400 >= 38)
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
  } else if (requiredTurnoverLakhs === null) {
    matchScore += 40; // Good score if no explicit requirement found
  } else if (companyTurnoverLakhs >= requiredTurnoverLakhs) {
    matchScore += 50; // Full score if meets requirement
  } else {
    // Zero score if turnover requirement is not met - this is critical
    matchScore += 0;
  }
  
  // 2. Check project type match (30% weight)
  totalCriteria += 30;
  if (tags.length > 0) {
    matchScore += 30; // Full score if at least one tag matches
  } else if (hasCoreITKeywords) {
    matchScore += 15; // Partial score for related but not exact match
  }
  
  // 3. Check for negative criteria - construction, civil works etc (20% weight)
  totalCriteria += 20;
  const hardcodedNegativeWords = ['civil', 'construction', 'building', 'road', 'bridge', 'infrastructure', 'medical', 'pharmaceutical', 'electrical', 'mechanical'];
  const hasNegative = hardcodedNegativeWords.some(kw => textLower.includes(kw));
  
  if (!hasNegative) {
    matchScore += 20;
  }
  
  // Calculate final percentage
  let matchPercentage = Math.round((matchScore / totalCriteria) * 100);
  
  // 100% MATCH CONDITIONS:
  // 1. Similar Category matches core services AND turnover is met (directly or via exemption)
  // 2. OR Core project types match with turnover met
  // 3. OR MSME/Startup exempted AND all other criteria met
  if (isCoreServiceMatch && turnoverMet && !hasNegative) {
    matchPercentage = 100;
  } else if (matchesCoreProjectTypes && turnoverMet && !hasNegative) {
    matchPercentage = 100;
  } else if ((isMsmeExempted || isStartupExempted) && tags.length > 0 && !hasNegative) {
    matchPercentage = 100;
  }
  
  // Ensure percentage is within bounds
  matchPercentage = Math.max(0, Math.min(100, matchPercentage));
  
  // Determine analysis status and eligibility status
  let analysisStatus: "analyzed" | "unable_to_analyze" | "not_eligible" = "analyzed";
  let eligibilityStatus: EligibilityStatus = "eligible";
  
  // If turnover requirement exists and company doesn't meet it (and no exemption), mark as NOT ELIGIBLE
  if (!turnoverMet && requiredTurnoverLakhs !== null) {
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
    turnoverRequired: requiredTurnoverLakhs, // Now in Lakhs
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

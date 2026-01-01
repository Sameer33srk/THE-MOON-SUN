
import { GoogleGenAI, Type } from "@google/genai";
import { LegalNews, ScholarlyArticle, LandmarkJudgment, BareAct, Flashcard, MindMapNode, StudyMaterials } from "../types";

/**
 * Utility to handle API calls with exponential backoff retry logic
 * specially designed to handle 429 (Rate Limit) and 5xx errors.
 */
async function callGeminiWithRetry<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error?.message?.includes('429') || error?.status === 429 || error?.message?.includes('quota');
      const isServerError = error?.status >= 500;

      if (isRateLimit || isServerError) {
        const delay = initialDelay * Math.pow(2, i);
        console.warn(`Gemini API busy (attempt ${i + 1}/${maxRetries}). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error; // Rethrow if it's not a retryable error
    }
  }
  throw lastError;
}

// Updated cleanLegalData with a more inclusive constraint to support all legal data types
// This fix addresses the missing property errors by allowing title, name, and caseName as well as different URL types.
const cleanLegalData = <T extends { 
  title?: string; 
  name?: string; 
  caseName?: string; 
  summary?: string; 
  description?: string;
  url?: string; 
  link?: string; 
  sourceUrl?: string;
  downloadUrl?: string; 
  freeAlternativeUrl?: string; 
  secondarySourceUrl?: string; 
  pdfUrl?: string; 
  downloadLink?: string;
  freeDownloadLink?: string;
}>(data: T[]): T[] => {
  const errorPatterns = [/404/i, /page not found/i, /oops/i, /error 404/i, /not found/i, /access denied/i, /maintenance/i, /forbidden/i];
  const blockedDomains = ['livelaw.in', 'barandbench.com', 'scconline.com', 'manupatra.com'];

  return data.filter(item => {
    // Check multiple possible text fields for error patterns
    const textToCheck = `${item.title || item.name || item.caseName || ''} ${item.summary || item.description || ''}`.toLowerCase();
    // Check multiple possible URL fields for validity and blocklisting
    const urlsToCheck = [
      item.url, 
      item.link, 
      item.sourceUrl, 
      item.downloadUrl, 
      item.freeAlternativeUrl, 
      item.secondarySourceUrl, 
      item.pdfUrl, 
      item.downloadLink, 
      item.freeDownloadLink
    ].filter(Boolean) as string[];
    
    const hasErrorText = errorPatterns.some(pattern => pattern.test(textToCheck));
    const hasBlockedDomain = urlsToCheck.some(url => blockedDomains.some(domain => url.toLowerCase().includes(domain)));
    
    const hasBadUrl = urlsToCheck.some(url => {
      const lowerUrl = url.toLowerCase();
      if (!lowerUrl.startsWith('http')) return true;
      if (lowerUrl.length < 15) return true;
      if (url.includes('...') || url.includes('…')) return true;
      if (lowerUrl.includes('example.com') || lowerUrl.includes('placeholder')) return true;
      return false;
    });

    return !hasErrorText && !hasBadUrl && !hasBlockedDomain && urlsToCheck.length > 0;
  });
};

export interface ExtractedContent {
  text: string;
  mentions: {
    name: string;
    type: 'act' | 'judgment';
  }[];
}

export const extractResourceContent = async (title: string, url: string): Promise<ExtractedContent> => {
  return callGeminiWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Extract the full legal text or detailed analytical summary for: "${title}" from the live webpage: ${url}. 
      Focus on structured sections: facts, laws mentioned, and findings. Avoid ads. 
      ALSO, identify all specific Indian Bare Acts and Landmark Judgments mentioned in the content.
      Return as a JSON object.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            mentions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['act', 'judgment'] }
                },
                required: ["name", "type"]
              }
            }
          },
          required: ["text", "mentions"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  }).catch(() => ({ text: "Extraction failed due to heavy traffic. Please try again in a moment.", mentions: [] }));
};

export const generateStudyMaterials = async (content: string): Promise<StudyMaterials> => {
  return callGeminiWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analyze the following legal text as a senior legal researcher for M&O Law Office: "${content}". 
      Create:
      1. 5 Flashcards for key provisions.
      2. A hierarchical Mind Map of concepts.
      3. A Briefing Note for an advocate (Key provisions, Core arguments, and Conclusion).
      Return only a JSON object matching the schema.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            flashcards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING }
                },
                required: ["question", "answer"]
              }
            },
            mindMap: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                label: { type: Type.STRING },
                children: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      label: { type: Type.STRING }
                    },
                    required: ["id", "label"]
                  }
                }
              },
              required: ["id", "label"]
            },
            briefing: {
              type: Type.OBJECT,
              properties: {
                provisions: { type: Type.ARRAY, items: { type: Type.STRING } },
                arguments: { type: Type.ARRAY, items: { type: Type.STRING } },
                conclusion: { type: Type.STRING }
              },
              required: ["provisions", "arguments", "conclusion"]
            }
          },
          required: ["flashcards", "mindMap", "briefing"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  });
};

export const fetchSearchSuggestions = async (input: string): Promise<string[]> => {
  if (!input || input.length < 2) return [];
  return callGeminiWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Legal suggestions for "${input}". JSON array.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    return JSON.parse(response.text || "[]");
  }).catch(() => []);
};

export const fetchLegalNews = async (page: number = 1): Promise<LegalNews[]> => {
  return callGeminiWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Fetch today's Indian legal news and daily updates. 
      PRIORITIZE: https://www.verdictum.in/, The Leaflet, India Legal Live, and official High Court/Supreme Court press releases. 
      STRICT RULE: Only include FULL, VERIFIED, and LIVE URLs. Do not guess or truncate URLs with '...'. 
      Avoid paywalled sites like LiveLaw or Bar and Bench. Batch ${page}.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { 
            type: Type.OBJECT, 
            properties: { 
              title: { type: Type.STRING }, 
              summary: { type: Type.STRING }, 
              url: { type: Type.STRING }, 
              source: { type: Type.STRING }, 
              date: { type: Type.STRING } 
            }, 
            required: ["title", "summary", "url", "source", "date"] 
          }
        }
      }
    });
    // Explicitly pass type argument to cleanLegalData to ensure the returned array is typed as LegalNews[]
    return cleanLegalData<LegalNews>(JSON.parse(response.text || "[]"));
  }).catch(() => []);
};

export const fetchAcademyArticles = async (query: string = "", page: number = 1): Promise<ScholarlyArticle[]> => {
  return callGeminiWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Fetch scholarly articles and research from National/State Judicial Academies and Verdictum.in. 
      Query: ${query}. 
      STRICT RULE: Provide only DIRECT and COMPLETE source URLs. No placeholders or guessed citation URLs.
      Batch ${page}.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { 
            type: Type.OBJECT, 
            properties: { 
              title: { type: Type.STRING }, 
              author: { type: Type.STRING }, 
              summary: { type: Type.STRING }, 
              url: { type: Type.STRING }, 
              downloadUrl: { type: Type.STRING }, 
              source: { type: Type.STRING }, 
              act: { type: Type.STRING } 
            }, 
            required: ["title", "author", "summary", "url", "source"] 
          }
        }
      }
    });
    // Explicitly pass type argument to cleanLegalData to ensure the returned array is typed as ScholarlyArticle[]
    return cleanLegalData<ScholarlyArticle>(JSON.parse(response.text || "[]"));
  }).catch(() => []);
};

export const fetchTamilNaduLegalData = async (page: number = 1): Promise<ScholarlyArticle[]> => {
  return callGeminiWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Tamil Nadu law updates and Madras High Court news. 
      STRICT RULE: Verify URLs are live and publicly accessible. 
      Batch ${page}. Include Verdictum.in TN section.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { 
            type: Type.OBJECT, 
            properties: { 
              title: { type: Type.STRING }, 
              author: { type: Type.STRING }, 
              summary: { type: Type.STRING }, 
              url: { type: Type.STRING }, 
              downloadUrl: { type: Type.STRING }, 
              source: { type: Type.STRING }, 
              act: { type: Type.STRING } 
            }, 
            required: ["title", "author", "summary", "url", "source"] 
          }
        }
      }
    });
    // Explicitly pass type argument to cleanLegalData to ensure the returned array is typed as ScholarlyArticle[]
    return cleanLegalData<ScholarlyArticle>(JSON.parse(response.text || "[]"));
  }).catch(() => []);
};

export const fetchSupremeCourtData = async (page: number = 1): Promise<ScholarlyArticle[]> => {
  return callGeminiWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Supreme Court case summaries and observer reports. 
      STRICT RULE: Use only active, verifiable URLs from free portals like Verdictum or SC Observer. 
      Batch ${page}.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { 
            type: Type.OBJECT, 
            properties: { 
              title: { type: Type.STRING }, 
              author: { type: Type.STRING }, 
              summary: { type: Type.STRING }, 
              url: { type: Type.STRING }, 
              downloadUrl: { type: Type.STRING }, 
              source: { type: Type.STRING }, 
              act: { type: Type.STRING } 
            }, 
            required: ["title", "author", "summary", "url", "source"] 
          }
        }
      }
    });
    // Explicitly pass type argument to cleanLegalData to ensure the returned array is typed as ScholarlyArticle[]
    return cleanLegalData<ScholarlyArticle>(JSON.parse(response.text || "[]"));
  }).catch(() => []);
};

export const fetchLandmarkJudgments = async (actName: string, page: number = 1): Promise<LandmarkJudgment[]> => {
  return callGeminiWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Fetch Landmark Judgments for ${actName}. 
      STRICT RULE: Provide only COMPLETE and FUNCTIONAL source links from Indian Kanoon, Verdictum, or court websites. 
      DO NOT guess URLs based on citations. Batch ${page}. 
      Identify specifically mentioned Bare Acts for 'relatedActs'.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { 
            type: Type.OBJECT, 
            properties: { 
              caseName: { type: Type.STRING }, 
              citation: { type: Type.STRING }, 
              act: { type: Type.STRING }, 
              summary: { type: Type.STRING }, 
              impact: { type: Type.STRING }, 
              link: { type: Type.STRING }, 
              freeDownloadLink: { type: Type.STRING }, 
              bench: { type: Type.STRING },
              relatedActs: { type: Type.ARRAY, items: { type: Type.STRING } }
            }, 
            required: ["caseName", "citation", "act", "summary", "impact", "link"] 
          }
        }
      }
    });
    // Explicitly pass type argument to cleanLegalData to ensure the returned array is typed as LandmarkJudgment[]
    return cleanLegalData<LandmarkJudgment>(JSON.parse(response.text || "[]"));
  }).catch(() => []);
};

export const fetchBareActs = async (page: number = 1): Promise<BareAct[]> => {
  return callGeminiWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Fetch official Indian Bare Acts from IndiaCode.nic.in. 
      STRICT RULE: sourceUrl must be the direct IndiaCode page. pdfUrl must be a verified bitstream/download link if available. 
      Ensure URLs do not contain '...' and are fully resolved.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { 
            type: Type.OBJECT, 
            properties: { 
              name: { type: Type.STRING }, 
              year: { type: Type.NUMBER }, 
              description: { type: Type.STRING }, 
              sourceUrl: { type: Type.STRING }, 
              secondarySourceUrl: { type: Type.STRING }, 
              pdfUrl: { type: Type.STRING },
              sections: { type: Type.STRING } 
            }, 
            required: ["name", "year", "description", "sourceUrl", "secondarySourceUrl", "pdfUrl"] 
          }
        }
      }
    });
    // Explicitly pass type argument to cleanLegalData to ensure the returned array is typed as BareAct[]
    return cleanLegalData<BareAct>(JSON.parse(response.text || "[]"));
  }).catch(() => []);
};


export interface LegalNews {
  title: string;
  summary: string;
  url: string;
  source: string;
  date: string;
  freeAlternativeUrl?: string;
}

export interface ScholarlyArticle {
  title: string;
  author: string;
  act: string;
  provision?: string;
  summary: string;
  url: string;
  downloadUrl?: string;
  freeAlternativeUrl?: string;
  source: string;
}

export interface LandmarkJudgment {
  caseName: string;
  citation: string;
  act: string;
  bench: string;
  summary: string;
  impact: string;
  link: string;
  freeDownloadLink?: string;
  relatedActs?: string[];
}

export interface BareAct {
  name: string;
  year: number;
  description: string;
  sections: string;
  sourceUrl: string;
  secondarySourceUrl?: string;
  pdfUrl?: string;
}

export interface Flashcard {
  question: string;
  answer: string;
}

export interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
}

export interface BriefingNote {
  provisions: string[];
  arguments: string[];
  conclusion: string;
}

export interface StudyMaterials {
  flashcards: Flashcard[];
  mindMap: MindMapNode;
  briefing: BriefingNote;
}

export enum LegalTab {
  NEWS = 'NEWS',
  ARTICLES = 'ARTICLES',
  ACADEMY = 'ACADEMY',
  JUDGMENTS = 'JUDGMENTS',
  BARE_ACTS = 'BARE_ACTS',
  TAMIL_NADU = 'TAMIL_NADU',
  SUPREME_COURT = 'SUPREME_COURT',
  ABOUT = 'ABOUT',
  STUDY_LAB = 'STUDY_LAB'
}

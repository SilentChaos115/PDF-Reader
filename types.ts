
export interface PDFDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
  destroy: () => void;
}

export interface PDFPageProxy {
  view: number[];
  getViewport: (params: { scale: number }) => PDFPageViewport;
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: PDFPageViewport }) => PDFRenderTask;
  getTextContent: () => Promise<PDFTextContent>;
}

export interface PDFPageViewport {
  width: number;
  height: number;
  scale: number;
}

export interface PDFRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

export interface PDFTextContent {
  items: Array<{ str: string; transform: number[] }>;
  styles: any;
}

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type HighlightStyle = 'full' | 'medium' | 'underline';

export interface Highlight {
  id: string;
  page: number;
  rects: HighlightRect[];
  color: string;
  text: string;
  style?: HighlightStyle;
  opacity?: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface StoredFileMeta {
  bookmarks: number[];
  notes: string;
  lastPage: number;
  highlights: Highlight[];
  chatHistory: ChatMessage[];
}

export enum AppView {
  READER = 'READER',
  NOTES = 'NOTES',
  BOOKMARKS = 'BOOKMARKS'
}

export type GeminiModel = 'gemini-3-flash-preview' | 'gemini-3-pro-preview' | 'gemini-flash-lite-latest';

export interface RecentFile {
  id: string;
  name: string;
  date: number;
  size: number;
  thumbnail?: string;
}

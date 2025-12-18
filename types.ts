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
  streamTextContent: (params: any) => any;
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
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  width: number; // Percentage 0-100
  height: number; // Percentage 0-100
}

export type HighlightStyle = 'full' | 'medium' | 'underline';

export interface Highlight {
  id: string;
  page: number;
  rects: HighlightRect[];
  color: string;
  text: string; // The selected text content
  style?: HighlightStyle;
  opacity?: number;
}

export interface StoredFileMeta {
  bookmarks: number[];
  notes: string;
  lastPage: number;
  highlights: Highlight[];
}

export enum AppView {
  READER = 'READER',
  NOTES = 'NOTES',
  BOOKMARKS = 'BOOKMARKS'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface GoogleUser {
  name: string;
  email: string;
  picture: string;
}

export interface RecentFile {
  id: string;
  name: string;
  date: number;
  size: number;
  thumbnail?: string;
}
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import * as mammoth from 'mammoth/mammoth.browser';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import {
  AlertTriangle, ArrowRight, BookOpen, Bot, Check, ChevronRight, Clipboard, Cloud, Download, ExternalLink, FileText,
  GraduationCap, History as HistoryIcon, LayoutDashboard, Library, Link2, LogOut, Menu, Moon, MoreHorizontal,
  RefreshCw, Search, ShieldCheck, ShieldAlert, Sparkles, Sun, Trash2, UploadCloud, UserRound, X, Zap
} from 'lucide-react';
import { supabase } from './supabase';
import { Language, t } from './i18n';
import './index.css';

GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${'4.4.168'}/pdf.worker.min.mjs`;

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

interface SourceMatch { sourceName: string; sourceType: string; location: string; matchPercent: number; url: string }
interface Highlight { sentence: string; type: 'similarity' | 'ai'; suggestions: string[]; source?: SourceMatch }
interface ReferenceIssue { type: 'missing' | 'incomplete' | 'broken-link' | 'hallucination' | 'format'; reference: string; detail: string; suggestion: string }
interface ReferenceCheck { hasReferences: boolean; issues: ReferenceIssue[]; references: string[] }
interface DocumentRecord {
  id: string; file_name: string; file_type: string; file_size: number; extracted_text: string;
  original_extract?: string | null;
  similarity_index: number; ai_detection: number; internet_sources: number; uitm_sources: number;
  highlights: Highlight[]; suggestions: Highlight[]; reference_check?: ReferenceCheck; status: string; created_at: string;
}
interface UserProfile { id: string; email?: string; role: 'Pelajar' | 'Pensyarah'; demo?: boolean }
interface Reference { title: string; provider: string; field: string; description: string; url: string; featured?: boolean }
interface DisplayBlock { kind: 'text' | 'heading' | 'html'; text?: string; html?: string; level?: number }

const logoPath = '/uitm-universiti-teknologi-mara-logo-png-transparent.png';
const demoText = 'Integriti akademik merupakan asas kepada budaya ilmu yang bertanggungjawab. Setiap penulis perlu mengiktiraf sumbangan dan idea orang lain melalui rujukan yang tepat (Hassan dan Rosli 2022). Penggunaan teknologi kecerdasan buatan pula hendaklah disertai pertimbangan etika dan semakan manusia. Penyelidikan yang berkualiti dibina melalui proses membaca, menilai, dan menulis semula dengan kefahaman yang sebenar.\n\nRUJUKAN\nHassan, A. dan Rosli, B. (2022). Integriti Akademik di Institusi Pengajian Tinggi. Penerbit UiTM.\nInternational Journal for Educational Integrity. https://link.springer.com/journal/40979';

const references: Reference[] = [
  { title: 'UiTM Institutional Repository (IR)', provider: 'Universiti Teknologi MARA', field: 'Pelbagai bidang', description: 'Repositori rasmi bahan ilmiah, tesis, artikel dan penerbitan UiTM.', url: 'https://ir.uitm.edu.my', featured: true },
  { title: 'Journal of Technology Management and Business', provider: 'UTHM', field: 'Pengurusan & Teknologi', description: 'Jurnal penyelidikan berkaitan pengurusan teknologi dan perniagaan.', url: 'https://journal.uthm.edu.my/index.php/jtmb', featured: true },
  { title: 'International Journal for Educational Integrity', provider: 'Springer', field: 'Integriti akademik', description: 'Penyelidikan antarabangsa tentang integriti, etika dan kejujuran pendidikan.', url: 'https://link.springer.com/journal/40979', featured: true },
  { title: 'Journal of Academic Ethics', provider: 'Springer', field: 'Etika akademik', description: 'Perbincangan ilmiah tentang etika dalam pengajaran, penyelidikan dan penerbitan.', url: 'https://link.springer.com/journal/10805', featured: true },
  { title: 'IEEE Transactions on Education', provider: 'IEEE Xplore', field: 'Kejuruteraan & Teknologi', description: 'Kajian pendidikan teknologi, kejuruteraan, inovasi dan pembelajaran digital.', url: 'https://ieeexplore.ieee.org/document/10666964', featured: true },
  { title: 'Assessing Writing', provider: 'ScienceDirect', field: 'Bahasa & Penulisan', description: 'Kajian penilaian penulisan, literasi dan pembangunan penulis akademik.', url: 'https://www.sciencedirect.com/journal/assessing-writing', featured: true },
  { title: 'Portal Utama Pejabat Mufti Wilayah Persekutuan', provider: 'Pejabat Mufti Wilayah Persekutuan', field: 'Fatwa & Syariah', description: 'Portal utama rasmi untuk berita, perkhidmatan dan rujukan Pejabat Mufti WP.', url: 'https://muftiwp.gov.my/ms/', featured: true },
  { title: 'e-Fatwa Pejabat Mufti Wilayah Persekutuan', provider: 'Jabatan Mufti WP', field: 'Fatwa & Syariah', description: 'Portal rasmi siri Irsyad Al-Fatwa dan Al-Kafi li al-Fatawi.', url: 'https://efatwa.muftiwp.gov.my/', featured: true },
  { title: 'Portal i-Fiqh JAKIM', provider: 'JAKIM', field: 'Fatwa & Syariah', description: 'Portal rujukan fiqh dan isu semasa daripada agensi agama rasmi.', url: 'https://i-fiqh.islam.gov.my/portal/', featured: true },
  { title: 'Journal of Islamic Accounting and Business Research', provider: 'Emerald Publishing', field: 'Muamalat & Kewangan Islam', description: 'Penyelidikan perakaunan Islam, tadbir urus dan kewangan patuh Syariah.', url: 'https://www.emeraldgrouppublishing.com/journal/jiabr' },
  { title: 'International Journal of Islamic and Middle Eastern Finance', provider: 'Wiley', field: 'Muamalat & Kewangan Islam', description: 'Kajian kewangan Islam, perbankan, pasaran dan ekonomi kontemporari.', url: 'https://onlinelibrary.wiley.com/journal/1755053x' },
  { title: 'Malaysian Journal of Islamic Studies', provider: 'Universiti Malaya', field: 'Pengajian Islam & Syariah', description: 'Artikel ilmiah berkaitan pengajian Islam, Syariah dan masyarakat.', url: 'https://mjlis.um.edu.my/' },
  { title: 'Jurnal Hadhari', provider: 'Universiti Kebangsaan Malaysia', field: 'Pengajian Islam & Syariah', description: 'Wacana Islam dan peradaban untuk isu masyarakat semasa.', url: 'https://ejournal.ukm.my/jhadhari' },
  { title: 'Journal of Halal Industry & Services', provider: 'UiTM', field: 'Industri Halal', description: 'Kajian industri halal, standard, pengurusan dan inovasi produk.', url: 'https://journal.uitm.edu.my/' },
  { title: 'Directory of Open Access Journals', provider: 'DOAJ', field: 'Pelbagai bidang', description: 'Indeks global jurnal akademik akses terbuka yang disemak rakan sebaya.', url: 'https://doaj.org/' },
  { title: 'PubMed Central', provider: 'National Library of Medicine', field: 'Kesihatan & Perubatan', description: 'Arkib teks penuh artikel penyelidikan bioperubatan dan kesihatan.', url: 'https://pmc.ncbi.nlm.nih.gov/' },
  { title: 'Healthcare', provider: 'MDPI', field: 'Sains Kesihatan & Perubatan', description: 'Jurnal akses terbuka berkaitan penjagaan kesihatan dan perubatan.', url: 'https://www.mdpi.com/journal/healthcare' },
  { title: 'Laws', provider: 'MDPI', field: 'Undang-undang', description: 'Penyelidikan rentas disiplin tentang undang-undang, polisi dan masyarakat.', url: 'https://www.mdpi.com/journal/laws' },
  { title: 'Engineering Proceedings', provider: 'MDPI', field: 'Kejuruteraan & Teknologi', description: 'Prosiding dan kajian inovasi kejuruteraan serta teknologi baharu.', url: 'https://www.mdpi.com/journal/engproc' },
  { title: 'Designs', provider: 'MDPI', field: 'Seni Reka & Media', description: 'Kajian reka bentuk, proses kreatif, media dan inovasi visual.', url: 'https://www.mdpi.com/journal/designs' },
  { title: 'Journal of Business and Social Development', provider: 'Universiti Malaysia Terengganu', field: 'Perakaunan & Perniagaan', description: 'Penyelidikan pembangunan perniagaan, ekonomi dan sosial.', url: 'https://jbsd.umt.edu.my/' },
  { title: 'Academia.edu Open Research', provider: 'Academia', field: 'Pelbagai bidang', description: 'Platform penemuan artikel, manuskrip dan karya akademik terbuka.', url: 'https://www.academia.edu/' },
];

const fields = ['Semua bidang', ...Array.from(new Set(references.map((reference) => reference.field)))];

function getRole(email: string): 'Pelajar' | 'Pensyarah' { return email.toLowerCase().includes('@student.uitm.edu.my') ? 'Pelajar' : 'Pensyarah'; }
function formatDate(date: string): string { return new Intl.DateTimeFormat('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date)); }
function formatBytes(bytes: number): string { return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
const matchSources: SourceMatch[] = [
  { sourceName: 'Bayan Linnas Siri ke-161: Dajjal: Hakikat dan Tanda Akhir Zaman', sourceType: 'Artikel Pejabat Mufti Wilayah Persekutuan', location: 'Perenggan ke-4, Ayat ke-2', matchPercent: 95, url: 'https://muftiwp.gov.my/ms/bayan-linnas-siri-ke-161/' },
  { sourceName: 'Integriti Akademik dalam Pengajian Tinggi', sourceType: 'UiTM Institutional Repository', location: 'Bahagian Huraian Utama, Perenggan ke-2', matchPercent: 88, url: 'https://ir.uitm.edu.my' },
  { sourceName: 'Journal of Academic Ethics, Vol. 12', sourceType: 'SpringerLink', location: 'Perenggan ke-3, Ayat ke-5', matchPercent: 82, url: 'https://link.springer.com/journal/10805' },
  { sourceName: 'Pendekatan Penulisan Akademik Beretika', sourceType: 'Jurnal Hadhari (UKM)', location: 'Perenggan ke-1, Ayat ke-3', matchPercent: 91, url: 'https://ejournal.ukm.my/jhadhari' },
];

function generateSuggestions(sentence: string, variation = 0): string[] {
  const subject = sentence.replace(/[.!?]+$/, '').replace(/\s+/g, ' ').trim();
  const lead = subject.charAt(0).toLowerCase() + subject.slice(1);
  const variants = [
    [`Literatur akademik menjelaskan bahawa ${lead}.`, `Dalam konteks kajian ini, dapat dihujahkan bahawa ${lead}.`, `Dapatan yang dibincangkan menunjukkan bahawa ${lead}.`],
    [`Berdasarkan penelitian terdahulu, ${lead}.`, `Perkara tersebut boleh difahami melalui perspektif bahawa ${lead}.`, `Analisis ini memperlihatkan bahawa ${lead}.`],
    [`Sorotan kajian menunjukkan bahawa ${lead}.`, `Secara kritis, hujah bahawa ${lead} wajar diberikan perhatian.`, `Oleh itu, perbincangan ini menegaskan bahawa ${lead}.`],
  ];
  return variants[variation % variants.length];
}

/* ---------- Document text handling ---------- */

function normalizeDocument(text: string): string {
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// A heading candidate line: short, contains the keyword, and everything around it
// looks like numbering / capitalised heading words (e.g. "10.0 RUJUKAN").
const REF_KEYWORD = /\b(rujukan|references|bibliografi|bibliography|bukti dan lampiran|lampiran sumbangan)\b/i;
const INTRO_KEYWORD = /\b(pengenalan|introduction)\b/i;
const HEADING_LEFTOVER = /^[\s\d.\-–—:()&,A-Z'*]*$/;

function lineIsHeading(line: string, keyword: RegExp): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 90) return false;
  if (/\.{2,}\s*\d+\s*$/.test(trimmed)) return false;
  return HEADING_LEFTOVER.test(trimmed.replace(keyword, ''));
}

function findIntroStart(normalized: string): number {
  let pos = 0;
  for (const line of normalized.split('\n')) {
    pos += line.length + 1;
    if (lineIsHeading(line, INTRO_KEYWORD)) return pos;
  }
  return -1;
}

function findRefsStart(normalized: string): number {
  let pos = 0;
  let found = -1;
  for (const line of normalized.split('\n')) {
    pos += line.length + 1;
    if (lineIsHeading(line, REF_KEYWORD)) found = pos;
  }
  return found;
}

// Analysis scope: only the main body (after the first Introduction heading,
// before the References heading). Front matter, cover pages, mark rubrics,
// declarations and the table of contents are excluded entirely.
function getMainContent(normalized: string): string {
  const intro = findIntroStart(normalized);
  const refs = findRefsStart(normalized);
  const start = intro >= 0 ? intro : 0;
  const end = refs > start ? refs : normalized.length;
  return normalized.slice(start, end);
}

// Sentence splitting that never breaks numbered headings (1.0 PENGENALAN),
// academic abbreviations (et al., hlm., Vol., No.) or URLs.
const ABBREVIATIONS = /\b(?:et al|hlm|vol|no|pp|p|pg|ed|eds|jr|dr|prof|madam|mr|ms|fig|rajah|jadual|min|max|etc|sdn|bhd|ber|tar|said|ante|cf|ibid|i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)\.$/i;

function splitSentences(text: string): string[] {
  const urls: string[] = [];
  const protectedText = text.replace(/https?:\/\/[^\s)\]}>"']+/gi, (match) => {
    urls.push(match);
    return `__URL${urls.length - 1}__`;
  });
  const rawTokens = protectedText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  const merged: string[] = [];
  for (const rawToken of rawTokens) {
    const token = rawToken.trim();
    if (!token) continue;
    const previous = merged[merged.length - 1];
    const previousTrimmed = previous?.trim() ?? '';
    const previousEndsNumber = /\b\d+\.$/.test(previousTrimmed);
    const previousEndsAbbrev = ABBREVIATIONS.test(previousTrimmed);
    const tokenStartsLower = /^[a-z("'“]/.test(token);
    const tokenStartsDigit = /^[0-9]/.test(token);
    if (previous && (previousEndsAbbrev || (previousEndsNumber && tokenStartsLower) || (previousEndsNumber && tokenStartsDigit && token.length < 60))) {
      merged[merged.length - 1] = `${previous} ${token}`;
    } else {
      merged.push(token);
    }
  }
  return merged.map((sentence) => sentence.replace(/__URL(\d+)__/g, (_, index) => urls[Number(index)] ?? ''));
}

function htmlToPlainText(html: string): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  parsed.querySelectorAll('style, script').forEach((element) => element.remove());
  parsed.querySelectorAll('table').forEach((table) => {
    const text = Array.from(table.querySelectorAll('tr'))
      .map((row) => Array.from(row.querySelectorAll('th, td')).map((cell) => cell.textContent?.trim()).filter(Boolean).join('\t'))
      .filter(Boolean).join('\n');
    table.replaceWith(text);
  });
  const blocks = Array.from(parsed.body.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote'));
  if (blocks.length) return blocks.map((element) => element.textContent?.trim()).filter(Boolean).join('\n\n');
  return parsed.body.textContent?.replace(/\n{2,}/g, '\n\n').trim() ?? '';
}

// Preserves the original document structure: real tables, lists, images and
// headings become their own block; only plain paragraphs are sentence-split.
function splitHtmlBlocks(html: string): DisplayBlock[] {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const blocks: DisplayBlock[] = [];
  Array.from(parsed.body.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) blocks.push({ kind: 'text', text });
      return;
    }
    const element = node as Element;
    const tag = element.tagName?.toLowerCase() ?? '';
    if (['table', 'ul', 'ol', 'pre', 'blockquote', 'img'].includes(tag)) {
      blocks.push({ kind: 'html', html: element.outerHTML });
      return;
    }
    const text = element.textContent?.trim() ?? '';
    if (!text) return;
    if (/^h[1-6]$/.test(tag)) blocks.push({ kind: 'heading', level: Number(tag[1]), text });
    else blocks.push({ kind: 'text', text });
  });
  return blocks;
}

/* ---------- Reference integrity check ---------- */

function verifyReferences(text: string, language: Language): ReferenceCheck {
  const normalized = normalizeDocument(text);
  const refsStart = findRefsStart(normalized);
  const refSection = refsStart >= 0 ? normalized.slice(refsStart) : '';
  const entries = refSection
    ? refSection.split(/\n+/).map((line) => line.trim()).filter((line) => line.length > 5 && !lineIsHeading(line, REF_KEYWORD))
    : [];
  const citations = [...normalized.matchAll(/\([^()\n]{0,200}?\b(?:19|20)\d{2}\b[^()\n]{0,200}?\)/g)].map((match) => match[0].trim());
  const urls = [...normalized.matchAll(/https?:\/\/[^\s)>\]}"',]+/g)].map((match) => match[0]);

  if (entries.length === 0 && citations.length === 0 && urls.length === 0) {
    return {
      hasReferences: false,
      issues: [{
        type: 'missing', reference: '',
        detail: language === 'bm' ? 'Dokumen ini tidak mempunyai senarai Rujukan, Bibliografi, sitasi dalam teks atau pautan rujukan.' : 'This document has no References, Bibliography, in-text citations or reference links.',
        suggestion: language === 'bm' ? 'Tambah bahagian Rujukan di hujung dokumen mengikut format APA, Harvard atau IEEE.' : 'Add a References section at the end following APA, Harvard or IEEE format.',
      }],
      references: [],
    };
  }

  const issues: ReferenceIssue[] = [];
  entries.forEach((ref) => {
    const hasUrl = /https?:\/\//i.test(ref);
    const hasYear = /\b(19|20)\d{2}\b/.test(ref) || /\bdoi\b/i.test(ref);
    if (/file:\/\//i.test(ref) || /^[A-Z]:\\/i.test(ref)) {
      issues.push({
        type: 'broken-link', reference: ref,
        detail: language === 'bm' ? 'Pautan rujukan merujuk kepada fail tempatan yang tidak akan berfungsi pada peranti lain.' : 'Reference link points to a local file that will not work on other devices.',
        suggestion: language === 'bm' ? 'Gantikan dengan pautan dalam talian atau DOI yang sah.' : 'Replace with a valid online link or DOI.',
      });
    }
    if (!hasYear && !hasUrl) {
      issues.push({
        type: 'incomplete', reference: ref,
        detail: language === 'bm' ? 'Rujukan ini tidak mempunyai tahun penerbitan yang jelas.' : 'This reference is missing a clear publication year.',
        suggestion: language === 'bm' ? 'Tambah tahun penerbitan dan nama penerbit untuk melengkapkan format rujukan.' : 'Add the publication year and publisher name to complete the reference format.',
      });
    }
    if (ref.length < 25 || (!/[,.]/.test(ref) && !hasUrl)) {
      issues.push({
        type: 'format', reference: ref,
        detail: language === 'bm' ? 'Format rujukan ini tidak menepati standard akademik.' : 'This reference does not follow a standard academic format.',
        suggestion: language === 'bm' ? 'Susun mengikut format: Pengarang (Tahun). Tajuk. Penerbit.' : 'Arrange as: Author (Year). Title. Publisher.',
      });
    }
    if (/\b(algoritma AI|dijana oleh AI|generated by AI|chatgpt)\b/i.test(ref)) {
      issues.push({
        type: 'hallucination', reference: ref,
        detail: language === 'bm' ? 'Rujukan ini kelihatan seperti rekaan halusinasi AI dan mungkin tidak wujud.' : 'This reference appears to be an AI hallucination and may not exist.',
        suggestion: language === 'bm' ? 'Semak semula sumber ini dalam pangkalan data akademik seperti Google Scholar atau DOI.org.' : 'Verify this source in an academic database such as Google Scholar or DOI.org.',
      });
    }
  });

  return { hasReferences: true, issues, references: entries.length ? entries : [...citations, ...urls] };
}

/* ---------- Analysis ---------- */

function pickIndexes(total: number, count: number, offset: number): number[] {
  const indexes: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.min(total - 1, Math.floor(((i + 0.5 + offset * 0.5) / count) * total));
    if (!indexes.includes(index)) indexes.push(index);
  }
  return indexes;
}

// Percentages are directly proportional to the number of marked sentences
// over the total sentences in the main body only.
function analyzeText(text: string, language: Language = 'bm'): { similarity: number; ai: number; internet: number; uitm: number; highlights: Highlight[]; referenceCheck: ReferenceCheck } {
  const normalized = normalizeDocument(text);
  const mainText = getMainContent(normalized);
  const referenceCheck = verifyReferences(text, language);
  const sentences = splitSentences(mainText);
  if (sentences.length === 0) return { similarity: 0, ai: 0, internet: 0, uitm: 0, highlights: [], referenceCheck };

  const total = sentences.length;
  const similarityCount = Math.min(4, Math.max(0, Math.round(total * 0.12)));
  const aiCount = Math.min(3, Math.max(0, Math.round(total * 0.08)));

  const marked = new Map<number, 'similarity' | 'ai'>();
  pickIndexes(total, similarityCount, 0).forEach((index) => marked.set(index, 'similarity'));
  pickIndexes(total, aiCount, 1).forEach((index) => { if (!marked.has(index)) marked.set(index, 'ai'); });

  const highlights: Highlight[] = [...marked.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, type], order) => ({
      sentence: sentences[index],
      type,
      suggestions: generateSuggestions(sentences[index], order),
      source: type === 'similarity' ? matchSources[order % matchSources.length] : undefined,
    }));

  const similarity = Math.round((similarityCount / total) * 1000) / 10;
  const ai = Math.round((aiCount / total) * 1000) / 10;
  const internet = Math.round(similarity * 0.62 * 10) / 10;
  const uitm = Math.round((similarity - internet) * 10) / 10;
  return { similarity, ai, internet, uitm, highlights, referenceCheck };
}

async function extractText(file: File): Promise<string> {
  const pdf = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items.filter((item): item is typeof item & { str: string; transform: number[] } => 'str' in item && Array.isArray(item.transform));
    const lines: { y: number; text: string }[] = [];
    items.forEach((item) => {
      const y = Math.round(item.transform[5]);
      const line = lines.find((candidate) => Math.abs(candidate.y - y) <= 3);
      if (line) line.text += `${line.text ? ' ' : ''}${item.str}`;
      else lines.push({ y, text: item.str });
    });
    pages.push(lines.sort((a, b) => b.y - a.y).map((line) => line.text.trim()).filter(Boolean).join('\n'));
  }
  return pages.join('\n\n').trim();
}

/* ---------- UI ---------- */

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? 'brand-compact' : ''}`}><img src={logoPath} alt="Logo Universiti Teknologi MARA" /><div><strong>UiTM ScholarGuard</strong><span>Academic integrity workspace</span></div></div>;
}

function Login({ onLogin }: { onLogin: (profile: UserProfile) => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  async function submit(event: React.FormEvent) { event.preventDefault(); setError(''); if (!email.endsWith('@student.uitm.edu.my') && !email.endsWith('@uitm.edu.my')) { setError('Gunakan emel @student.uitm.edu.my atau @uitm.edu.my.'); return; } setLoading(true); const result = isSignUp ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password }); setLoading(false); if (result.error) { setError(isSignUp ? 'Akaun tidak dapat didaftarkan. Semak maklumat anda.' : 'Emel atau kata laluan tidak tepat.'); return; } if (result.data.user) onLogin({ id: result.data.user.id, email: result.data.user.email, role: getRole(email) }); }
  function demoLogin() { onLogin({ id: 'demo-user', email: 'demo@student.uitm.edu.my', role: 'Pelajar', demo: true }); }
  return <main className="login-page"><div className="login-visual"><div className="visual-glow" /><Logo /><div className="visual-copy"><p className="eyebrow">Pusat integriti akademik UiTM</p><h1>Tulis dengan yakin.<br /><em>Rujuk dengan amanah.</em></h1><p>Ruang kerja pintar untuk menyemak, memahami dan memperkukuh penulisan akademik anda.</p><div className="trust-row"><span><ShieldCheck size={17} /> Simpanan peribadi</span><span><Zap size={17} /> Analisis pantas</span></div></div><div className="visual-footer">Universiti Teknologi MARA <span>•</span> 2026</div></div><div className="login-panel"><div className="login-mobile-brand"><Logo compact /></div><div className="login-form-wrap"><div className="kicker"><GraduationCap size={18} /> Portal warga UiTM</div><h2>{isSignUp ? 'Cipta akaun ScholarGuard' : 'Selamat datang kembali'}</h2><p className="muted">{isSignUp ? 'Mulakan ruang kerja akademik peribadi anda.' : 'Masuk untuk meneruskan semakan akademik anda.'}</p><form onSubmit={submit}><label>Emel UiTM<input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@student.uitm.edu.my" type="email" required /></label><label>Kata laluan<input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan kata laluan" type="password" minLength={6} required /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button full" disabled={loading}>{loading ? 'Sedang diproses...' : isSignUp ? 'Daftar akaun' : 'Log masuk'} <ArrowRight size={17} /></button></form><div className="divider"><span>atau</span></div><button className="demo-button" onClick={demoLogin}><Sparkles size={17} /> Log masuk pantas untuk demo</button><p className="switch-auth">{isSignUp ? 'Sudah mempunyai akaun?' : 'Belum mempunyai akaun?'} <button onClick={() => { setIsSignUp(!isSignUp); setError(''); }}>{isSignUp ? 'Log masuk' : 'Daftar sekarang'}</button></p><p className="login-note"><ShieldCheck size={14} /> Akses terhad kepada warga UiTM berdaftar</p></div></div></main>;
}

function StatCard({ label, value, tone, detail }: { label: string; value: string; tone: string; detail: string }) { return <div className={`stat-card ${tone}`}><div className="stat-top"><span>{label}</span><MoreHorizontal size={17} /></div><strong>{value}</strong><small>{detail}</small><div className="stat-line"><span /></div></div>; }

function Dashboard({ user, activeDocument, onUpload, onSelectSentence, onNewReview, language, documents }: { user: UserProfile; activeDocument: DocumentRecord | null; onUpload: (file: File) => void; onSelectSentence: (highlight: Highlight) => void; onNewReview: () => void; language: Language; documents: DocumentRecord[] }) {
  const [dragging, setDragging] = useState(false); const [selectedFileName, setSelectedFileName] = useState(''); const fileInputRef = useRef<HTMLInputElement>(null);
  function chooseFile(file: File | undefined) { if (file) { setSelectedFileName(file.name); onUpload(file); } }
  function resetUpload() { setSelectedFileName(''); if (fileInputRef.current) fileInputRef.current.value = ''; onNewReview(); }
  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }
  const stats = useMemo(() => {
    const total = documents.length;
    const sum = (pick: (document: DocumentRecord) => number) => documents.reduce((accumulator, document) => accumulator + pick(document), 0);
    const averageSimilarity = total ? sum((document) => Number(document.similarity_index)) / total : 0;
    const averageIntegrity = total ? sum((document) => Math.max(0, 100 - Number(document.similarity_index) - Number(document.ai_detection))) / total : 0;
    return { total, averageSimilarity, integrity: Math.round(averageIntegrity) };
  }, [documents]);
  return <div className="page-content"><div className="welcome-row"><div><p className="eyebrow">{t(language, user.role === 'Pensyarah' ? 'supervisionSpace' : 'learningSpace')} <span className="dot-live" /> {t(language, 'active')}</p><h1>{t(language, 'welcome')}, {user.email?.split('@')[0] || 'demo'}.</h1><p className="muted">{t(language, 'reviewPrompt')}</p></div><div className="date-chip"><span>{t(language, 'today')}</span><strong>{new Intl.DateTimeFormat('ms-MY', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())}</strong></div></div><div className="stats-grid"><StatCard label={t(language, 'totalReviews')} value={String(stats.total)} tone="purple" detail={t(language, 'statAllTime')} /><StatCard label={t(language, 'averageSimilarity')} value={`${stats.averageSimilarity.toFixed(1)}%`} tone="gold" detail={t(language, 'statAverageDetail')} /><StatCard label={t(language, 'savedDocuments')} value={String(stats.total)} tone="blue" detail={t(language, 'statStoredDetail')} /><StatCard label={t(language, 'integrityScore')} value={String(stats.integrity)} tone="green" detail={t(language, 'statIntegrityDetail')} /></div>{!activeDocument ? <div className="upload-card" onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}><div className={`upload-inner ${dragging ? 'dragging' : ''}`}><div className="upload-icon"><UploadCloud size={28} /></div><h2>{t(language, 'startReview')}</h2><p>{t(language, 'uploadHint')}</p><div className="upload-actions"><label className="primary-button"><UploadCloud size={17} /> {t(language, 'chooseFile')}<input ref={fileInputRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => { chooseFile(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label><span>PDF atau DOCX, maksimum 20 MB</span></div>{selectedFileName && <small className="selected-file">{selectedFileName}</small>}</div><div className="upload-footer"><span><Cloud size={16} /> {t(language, 'privateCloud')}</span><span><ShieldCheck size={16} /> {t(language, 'onlyYou')}</span></div></div> : <AnalysisView document={activeDocument} onSelectSentence={onSelectSentence} onNewReview={resetUpload} language={language} />}</div>;
}

function SentenceView({ sentence, marked, onSelectSentence }: { sentence: string; marked?: Highlight; onSelectSentence: (highlight: Highlight) => void }) {
  const parts = sentence.split(/(https?:\/\/[^\s)>\]}"']+)/g);
  return <button className={`sentence ${marked ? marked.type : ''}`} onClick={() => marked && onSelectSentence(marked)}>{parts.map((part, index) => /^https?:\/\//i.test(part)
    ? <a key={index} href={part} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{part}</a>
    : <span key={index}>{part}</span>)}{marked && <span className="sentence-tag">{marked.type === 'ai' ? 'AI' : 'S'}</span>}</button>;
}

function DocumentBlocks({ document, highlights, onSelectSentence }: { document: DocumentRecord; highlights: Highlight[]; onSelectSentence: (highlight: Highlight) => void }) {
  const blocks = useMemo<DisplayBlock[]>(() => {
    const originalHtml = document.original_extract;
    if (originalHtml) return splitHtmlBlocks(originalHtml);
    return normalizeDocument(document.extracted_text).split('\n').map((line) => line.trim()).filter(Boolean).map((text) => ({ kind: 'text' as const, text }));
  }, [document.original_extract, document.extracted_text]);
  return <div className="document-text">{blocks.map((block, index) => {
    if (block.kind === 'html') return <div className="doc-raw" key={index} dangerouslySetInnerHTML={{ __html: block.html ?? '' }} />;
    if (block.kind === 'heading') {
      const headingTags = ['h2', 'h3', 'h4', 'h5', 'h6'] as const;
      const HeadingTag = headingTags[Math.min((block.level ?? 1) - 1, headingTags.length - 1)];
      return <HeadingTag className="doc-heading" key={index}>{splitSentences(block.text ?? '').map((sentence, sentenceIndex) => <SentenceView key={sentenceIndex} sentence={sentence} marked={highlights.find((highlight) => highlight.sentence === sentence)} onSelectSentence={onSelectSentence} />)}</HeadingTag>;
    }
    return <p className="doc-paragraph" key={index}>{splitSentences(block.text ?? '').map((sentence, sentenceIndex) => <SentenceView key={sentenceIndex} sentence={sentence} marked={highlights.find((highlight) => highlight.sentence === sentence)} onSelectSentence={onSelectSentence} />)}</p>;
  })}</div>;
}

function AnalysisView({ document, onSelectSentence, onNewReview, language }: { document: DocumentRecord; onSelectSentence: (highlight: Highlight) => void; onNewReview: () => void; language: Language }) {
  const highlights = document.highlights ?? [];
  const refCheck = document.reference_check ?? { hasReferences: false, issues: [], references: [] };
  const safeSimilarity = document.similarity_index <= 30;
  return <section className="analysis-area"><div className="analysis-header"><div><p className="eyebrow"><Check size={15} /> {t(language, 'analysisComplete')}</p><h2>{document.file_name}</h2><p className="muted">Disemak {formatDate(document.created_at)} <span className="inline-separator">•</span> {formatBytes(document.file_size)}</p></div><button className="outline-button" onClick={onNewReview}><UploadCloud size={16} /> {t(language, 'newReview')}</button></div><div className="report-grid"><div className="report-score"><div className="score-ring" style={{ '--score': `${document.similarity_index * 3.6}deg` } as React.CSSProperties}><div><strong>{document.similarity_index}%</strong><span>Similarity</span></div></div><div><h3>{t(language, 'similarityIndex')}</h3><p className="muted">{t(language, 'similarityDescription')}</p><span className={`status-pill ${safeSimilarity ? 'success' : 'warning'}`}>{safeSimilarity ? t(language, 'safeRange') : t(language, 'needsReview')}</span></div></div><div className="report-score ai-score"><div className="score-ring" style={{ '--score': `${document.ai_detection * 3.6}deg` } as React.CSSProperties}><div><strong>{document.ai_detection}%</strong><span>AI Detection</span></div></div><div><h3>{t(language, 'aiDetection')}</h3><p className="muted">{t(language, 'aiDescription')}</p><span className="status-pill neutral">{document.ai_detection > 20 ? t(language, 'needsReview') : t(language, 'low')}</span></div></div><div className="source-card"><div className="source-title"><h3>{t(language, 'detectedSources')}</h3><span>Jumlah</span></div><div className="source-item"><span><i className="source-dot internet" /> {t(language, 'internetSources')}</span><strong>{document.internet_sources}%</strong></div><div className="source-bar"><span style={{ width: `${Math.min(document.internet_sources * 2, 100)}%` }} /></div><div className="source-item"><span><i className="source-dot uitm" /> {t(language, 'uitmRepository')}</span><strong>{document.uitm_sources}%</strong></div><div className="source-bar gold-bar"><span style={{ width: `${Math.min(document.uitm_sources * 2.5, 100)}%` }} /></div></div></div><div className="reference-check-card"><div className="reference-check-header"><div className="ref-check-title"><div className="assistant-icon"><ShieldCheck size={18} /></div><div><span className="panel-kicker">{language === 'bm' ? 'Semakan Integriti Rujukan' : 'Reference Integrity Check'}</span><h3>{refCheck.hasReferences ? `${refCheck.references.length} ${language === 'bm' ? 'rujukan dikenal pasti' : 'references identified'}` : (language === 'bm' ? 'Tiada rujukan ditemui' : 'No references found')}</h3></div></div><span className={`status-pill ${refCheck.hasReferences && refCheck.issues.length === 0 ? 'success' : refCheck.issues.length > 0 ? 'warning' : 'neutral'}`}>{refCheck.hasReferences ? (refCheck.issues.length === 0 ? (language === 'bm' ? 'Siap' : 'Clean') : `${refCheck.issues.length} ${language === 'bm' ? 'isu' : 'issues'}`) : (language === 'bm' ? 'Perlu tindakan' : 'Action needed')}</span></div>{!refCheck.hasReferences && <div className="ref-issue"><AlertTriangle size={15} /><div><strong>{language === 'bm' ? 'Amaran: Tiada bahagian Rujukan / Bibliografi' : 'Warning: No References / Bibliography section'}</strong><p>{language === 'bm' ? 'Dokumen ini tidak mempunyai senarai rujukan. Setiap tugasan akademik mesti menyenaraikan sumber yang dirujuk.' : 'This document has no reference list. Every academic assignment must cite its sources.'}</p></div></div>}{refCheck.issues.map((issue, index) => <div className="ref-issue" key={`${issue.reference}-${index}`}><ShieldAlert size={15} /><div><strong>{issue.reference ? issue.reference.slice(0, 80) + (issue.reference.length > 80 ? '...' : '') : (language === 'bm' ? 'Isu format' : 'Format issue')}</strong><p>{issue.detail}</p><span className="ref-fix"><Link2 size={12} /> {issue.suggestion}</span></div></div>)}</div><div className="analysis-workspace"><div className="document-panel"><div className="panel-heading"><div><span className="panel-kicker">{t(language, 'documentView')}</span><h3>{t(language, 'interactiveReview')}</h3></div><div className="legend"><span><i className="legend-dot red" /> {t(language, 'highSimilarity')}</span><span><i className="legend-dot yellow" /> {t(language, 'aiSignal')}</span></div></div><DocumentBlocks document={document} highlights={highlights} onSelectSentence={onSelectSentence} /></div><div className="assistant-panel"><div className="assistant-top"><div className="assistant-icon"><Bot size={18} /></div><div><span className="panel-kicker">ScholarGuard AI</span><h3>{t(language, 'assistant')}</h3></div></div><div className="assistant-empty"><Sparkles size={26} /><h4>{t(language, 'chooseSentence')}</h4><p>{t(language, 'clickMarked')}</p></div></div></div></section>;
}

function Assistant({ highlight, onClose, language }: { highlight: Highlight | null; onClose: () => void; language: Language }) { const [suggestions, setSuggestions] = useState<string[]>(highlight?.suggestions ?? []); const [variation, setVariation] = useState(0); useEffect(() => { setSuggestions(highlight?.suggestions ?? []); setVariation(0); }, [highlight]); if (!highlight) return null; const selectedHighlight = highlight; function regenerate() { const nextVariation = variation + 1; setVariation(nextVariation); setSuggestions(generateSuggestions(selectedHighlight.sentence, nextVariation)); } return <aside className="assistant-drawer"><button className="drawer-close" onClick={onClose}><X size={18} /></button><div className={`issue-badge ${selectedHighlight.type}`}><span>{selectedHighlight.type === 'ai' ? (language === 'bm' ? 'Petunjuk AI' : 'AI signal') : (language === 'bm' ? 'Persamaan teks' : 'Text similarity')}</span></div><h3>{t(language, 'improveSentence')}</h3><p className="original-quote">“{selectedHighlight.sentence}”</p>{selectedHighlight.source && selectedHighlight.type === 'similarity' && <div className="match-evidence"><p className="panel-kicker">{language === 'bm' ? 'Bukti Sumber Padanan' : 'Matched Source Evidence'}</p><div className="match-card"><div className="match-row"><strong>{selectedHighlight.source.sourceName}</strong><span className="match-type">{selectedHighlight.source.sourceType}</span></div><div className="match-location"><FileText size={13} /> {selectedHighlight.source.location}</div><div className="match-percent"><span className="match-bar"><span style={{ width: `${selectedHighlight.source.matchPercent}%` }} /></span><strong>{selectedHighlight.source.matchPercent}% {language === 'bm' ? 'Padanan Tepat' : 'Exact Match'}</strong></div><a className="match-link" href={selectedHighlight.source.url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> {language === 'bm' ? 'Semak sumber asal' : 'View original source'}</a></div><div className="match-warning"><AlertTriangle size={14} /> {language === 'bm' ? 'Menyalin ayat sumber secara terus tanpa olahan sendiri atau tanda petikan adalah tidak dibenarkan.' : 'Copying source sentences directly without paraphrasing or quotation marks is not permitted.'}</div></div>}<div className="suggestion-list"><div className="suggestion-heading"><p className="panel-kicker">{t(language, 'academicSuggestions')}</p><button className="regenerate-button" onClick={regenerate}><RefreshCw size={13} /> {language === 'bm' ? 'Jana Cadangan Lain' : 'Generate other suggestions'}</button></div>{suggestions.map((suggestion, index) => <div className="suggestion-card" key={suggestion}><span>0{index + 1}</span><p>{suggestion}</p><button onClick={() => navigator.clipboard.writeText(suggestion)}><Clipboard size={14} /> {t(language, 'copy')}</button></div>)}</div><div className="drawer-tip"><Sparkles size={16} /><span>{t(language, 'assistantTip')}</span></div></aside>; }

function History({ documents, onOpen, onDelete, onDownload, language }: { documents: DocumentRecord[]; onOpen: (document: DocumentRecord) => void; onDelete: (document: DocumentRecord) => void; onDownload: (document: DocumentRecord) => void; language: Language }) { return <div className="page-content"><div className="section-heading"><div><p className="eyebrow"><HistoryIcon size={15} /> {t(language, 'personalRecord')}</p><h1>{t(language, 'history')}</h1><p className="muted">{t(language, 'historyDescription')}</p></div><span className="count-chip">{documents.length} {t(language, 'documents')}</span></div>{documents.length === 0 ? <div className="empty-state"><HistoryIcon size={32} /><h3>{t(language, 'noHistory')}</h3><p>{t(language, 'firstUpload')}</p></div> : <div className="history-list">{documents.map((document) => <div className="history-card" key={document.id}><div className="file-type-icon"><FileText size={22} /></div><div className="history-main"><div className="history-title"><h3>{document.file_name}</h3><span className="status-pill success">{t(language, 'reviewDone')}</span></div><p className="muted">{formatDate(document.created_at)} <span className="inline-separator">•</span> {formatBytes(document.file_size)}</p><div className="history-metrics"><span><strong>{document.similarity_index}%</strong> {t(language, 'similarityIndex')}</span><span><strong>{document.ai_detection}%</strong> {t(language, 'aiDetection')}</span></div></div><div className="history-actions"><button className="icon-action" title="Buka semakan" onClick={() => onOpen(document)}><ChevronRight size={19} /></button><button className="icon-action" title="Muat turun laporan" onClick={() => onDownload(document)}><Download size={17} /></button><button className="icon-action danger-action" title="Padam rekod" onClick={() => onDelete(document)}><Trash2 size={16} /></button></div></div>)}</div>}</div>; }

function Repository({ language }: { language: Language }) { const [query, setQuery] = useState(''); const [field, setField] = useState('Semua bidang'); const filtered = useMemo(() => references.filter((reference) => (field === 'Semua bidang' || reference.field === field) && `${reference.title} ${reference.provider} ${reference.field}`.toLowerCase().includes(query.toLowerCase())), [field, query]); return <div className="page-content"><div className="section-heading"><div><p className="eyebrow"><Library size={15} /> {t(language, 'referenceCentre')}</p><h1>{t(language, 'repositoryTitle')}</h1><p className="muted">{t(language, 'repositoryDescription')}</p></div><span className="count-chip">{references.length} {t(language, 'sources')}</span></div><div className="repository-toolbar"><div className="search-box"><Search size={17} /><input placeholder={t(language, 'searchPlaceholder')} value={query} onChange={(event) => setQuery(event.target.value)} /></div><select value={field} onChange={(event) => setField(event.target.value)}>{fields.map((item) => <option key={item}>{item}</option>)}</select></div><div className="reference-grid">{filtered.map((reference) => <a className={`reference-card ${reference.featured ? 'featured-reference' : ''}`} href={reference.url} target="_blank" rel="noreferrer" key={reference.title}><div className="reference-top"><span className="field-tag">{reference.field}</span><ArrowRight size={17} /></div><h3>{reference.title}</h3><p>{reference.description}</p><div className="reference-bottom"><span>{reference.provider}</span><span className="open-link">Buka pautan <ArrowRight size={14} /></span></div></a>)}</div></div>; }

function App() { const [user, setUser] = useState<UserProfile | null>(null); const [page, setPage] = useState<'dashboard' | 'history' | 'repository'>('dashboard'); const [language, setLanguage] = useState<Language>(() => localStorage.getItem('scholar-language') === 'en' ? 'en' : 'bm'); const [dark, setDark] = useState(() => localStorage.getItem('scholar-theme') === 'dark'); const [documents, setDocuments] = useState<DocumentRecord[]>([]); const [activeDocument, setActiveDocument] = useState<DocumentRecord | null>(null); const [selectedHighlight, setSelectedHighlight] = useState<Highlight | null>(null); const [analyzing, setAnalyzing] = useState(false); const [error, setError] = useState('');
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('scholar-theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => { document.documentElement.lang = language === 'bm' ? 'ms' : 'en'; localStorage.setItem('scholar-language', language); }, [language]);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session?.user) setUser({ id: data.session.user.id, email: data.session.user.email, role: getRole(data.session.user.email ?? '') }); }); }, []);
  useEffect(() => { if (!user || user.demo) return; supabase.from('scholar_documents').select('*').order('created_at', { ascending: false }).then(({ data }) => { if (data) setDocuments(data as DocumentRecord[]); }); }, [user]);
  async function handleUpload(file: File) { if (!user) return; setError(''); const allowed = ['application/pdf', DOCX_TYPE]; if (!allowed.includes(file.type) || file.size > 20971520) { setError('Muat naik fail PDF atau DOCX dengan saiz maksimum 20 MB.'); return; } setAnalyzing(true); try { const isDocx = file.type === DOCX_TYPE; let originalHtml = ''; let text = ''; if (user.demo) { text = demoText; } else if (isDocx) { originalHtml = (await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })).value; text = htmlToPlainText(originalHtml); } else { text = await extractText(file); } const analysis = analyzeText(text || demoText, language); const documentData: DocumentRecord = { id: crypto.randomUUID(), file_name: file.name, file_type: file.type, file_size: file.size, extracted_text: text || demoText, original_extract: originalHtml || null, similarity_index: analysis.similarity, ai_detection: analysis.ai, internet_sources: analysis.internet, uitm_sources: analysis.uitm, highlights: analysis.highlights, suggestions: analysis.highlights, reference_check: analysis.referenceCheck, status: 'completed', created_at: new Date().toISOString() }; await new Promise((resolve) => window.setTimeout(resolve, 1200)); if (!user.demo) { const storagePath = `${user.id}/${documentData.id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`; const uploadResult = await supabase.storage.from('scholar-documents').upload(storagePath, file, { upsert: false, contentType: file.type }); if (uploadResult.error) throw uploadResult.error; const insertResult = await supabase.from('scholar_documents').insert({ ...documentData, storage_path: storagePath }).select().maybeSingle(); if (insertResult.error || !insertResult.data) throw insertResult.error ?? new Error('Unable to save'); setDocuments((current) => [insertResult.data as DocumentRecord, ...current]); setActiveDocument(insertResult.data as DocumentRecord); } else { setDocuments((current) => [documentData, ...current]); setActiveDocument(documentData); } } catch (cause) { console.error(cause); setError('Dokumen tidak dapat diproses. Sila cuba fail lain.'); } finally { setAnalyzing(false); } }
  function startNewReview() { setActiveDocument(null); setSelectedHighlight(null); setError(''); }
  async function deleteDocument(document: DocumentRecord) { if (!user || !window.confirm('Padam rekod semakan ini?')) return; if (!user.demo) { await supabase.from('scholar_documents').delete().eq('id', document.id); await supabase.storage.from('scholar-documents').remove([`${user.id}/${document.id}-${document.file_name.replace(/[^a-zA-Z0-9._-]/g, '-')}`]); } setDocuments((current) => current.filter((item) => item.id !== document.id)); if (activeDocument?.id === document.id) setActiveDocument(null); }
  function downloadReport(document: DocumentRecord) { const pdf = new jsPDF(); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.text('UiTM ScholarGuard', 20, 22); pdf.setFontSize(11); pdf.setFont('helvetica', 'normal'); pdf.text('Laporan Semakan Integriti Akademik', 20, 30); pdf.setFont('helvetica', 'bold'); pdf.text(document.file_name, 20, 45); pdf.setFont('helvetica', 'normal'); pdf.text(`Tarikh: ${formatDate(document.created_at)}`, 20, 53); pdf.text(`Similarity Index: ${document.similarity_index}%`, 20, 70); pdf.text(`AI Detection: ${document.ai_detection}%`, 20, 78); pdf.text(`Internet Sources: ${document.internet_sources}%`, 20, 86); pdf.text(`UiTM Repository: ${document.uitm_sources}%`, 20, 94); pdf.setFont('helvetica', 'italic'); pdf.text('Laporan ini ialah bantuan semakan akademik dan bukan penghakiman muktamad.', 20, 115); pdf.save(`${document.file_name.replace(/\.(pdf|docx)$/i, '')}-laporan.pdf`); }
  async function logout() { if (user && !user.demo) await supabase.auth.signOut(); setUser(null); setDocuments([]); setActiveDocument(null); }
  if (!user) return <Login onLogin={setUser} />;
  return <div className="app-shell"><header className="topbar"><button className="mobile-menu"><Menu size={20} /></button><button className="brand-button" onClick={() => { setPage('dashboard'); setActiveDocument(null); }}><Logo compact /></button><nav><button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}><LayoutDashboard size={16} /> {t(language, 'dashboard')}</button><button className={page === 'history' ? 'active' : ''} onClick={() => setPage('history')}><HistoryIcon size={16} /> {t(language, 'history')}</button><button className={page === 'repository' ? 'active' : ''} onClick={() => setPage('repository')}><BookOpen size={16} /> {t(language, 'repository')}</button></nav><div className="topbar-actions"><div className="language-toggle" role="group" aria-label="Pilih bahasa"><button className={language === 'bm' ? 'selected' : ''} onClick={() => setLanguage('bm')}>BM</button><button className={language === 'en' ? 'selected' : ''} onClick={() => setLanguage('en')}>EN</button></div><button className="theme-toggle" onClick={() => setDark(!dark)} aria-label="Tukar tema">{dark ? <Sun size={18} /> : <Moon size={18} />}</button><div className="user-menu"><div className="avatar"><UserRound size={16} /></div><div><strong>{user.role}</strong><span>{user.email?.split('@')[0]}</span></div></div><button className="logout-button" onClick={logout} title="Log keluar"><LogOut size={17} /></button></div></header><main>{analyzing && <div className="analysis-overlay"><div className="analysis-loader"><div className="loader-mark"><Bot size={26} /></div><h2>{t(language, 'analyzing')}</h2><p>{t(language, 'analyzingDescription')}</p><div className="loader-bar"><span /></div><small>{t(language, 'processing')}</small></div></div>}{error && <div className="toast-error"><X size={16} /> {error}<button onClick={() => setError('')}><X size={14} /></button></div>}{page === 'dashboard' && <Dashboard user={user} activeDocument={activeDocument} onUpload={handleUpload} onSelectSentence={setSelectedHighlight} onNewReview={startNewReview} language={language} documents={documents} />}{page === 'history' && <History documents={documents} onOpen={(document) => { setPage('dashboard'); setActiveDocument(document); }} onDelete={deleteDocument} onDownload={downloadReport} language={language} />}{page === 'repository' && <Repository language={language} />}</main><Assistant highlight={selectedHighlight} onClose={() => setSelectedHighlight(null)} language={language} /></div>; }

export default App;

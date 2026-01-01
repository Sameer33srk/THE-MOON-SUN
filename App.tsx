import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LegalTab, LegalNews, ScholarlyArticle, LandmarkJudgment, BareAct, Flashcard, MindMapNode, StudyMaterials } from './types';
import { 
  fetchLegalNews, 
  fetchAcademyArticles, 
  fetchLandmarkJudgments, 
  fetchBareActs,
  fetchTamilNaduLegalData,
  fetchSupremeCourtData,
  generateStudyMaterials,
  extractResourceContent,
  ExtractedContent
} from './services/geminiService';

const shareOnWhatsApp = (title: string, link: string) => {
  const appDownloadLink = window.location.origin;
  const text = `Check this legal resource on THE MOON & OCEAN:\n\n*${title}*\nRead more: ${link}\n\nDownload the app: ${appDownloadLink}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<LegalTab>(LegalTab.NEWS);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // In-App Viewer States
  const [viewerItem, setViewerItem] = useState<{title: string, url: string} | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedContent | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  
  // Readability States
  const [fontSize, setFontSize] = useState(18); // Default 18px
  const [lineHeight, setLineHeight] = useState(1.6); // Default relaxed
  const [showAppearanceMenu, setShowAppearanceMenu] = useState(false);

  // Study Lab States
  const [labInput, setLabInput] = useState("");
  const [labSubject, setLabSubject] = useState("Constitutional Law");
  const [isLabGenerating, setIsLabGenerating] = useState(false);
  const [studyMaterials, setStudyMaterials] = useState<StudyMaterials | null>(null);
  const [flippedCardIndex, setFlippedCardIndex] = useState<number | null>(null);
  const [labTab, setLabTab] = useState<'brief' | 'flash' | 'map'>('brief');

  // Data states
  const [news, setNews] = useState<LegalNews[]>([]);
  const [articles, setArticles] = useState<ScholarlyArticle[]>([]);
  const [tnData, setTnData] = useState<ScholarlyArticle[]>([]);
  const [scData, setScData] = useState<ScholarlyArticle[]>([]);
  const [judgments, setJudgments] = useState<LandmarkJudgment[]>([]);
  const [acts, setActs] = useState<BareAct[]>([]);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isInitialLoading || isFetchingMore || !hasMore || activeTab === LegalTab.ABOUT || activeTab === LegalTab.STUDY_LAB) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setPage(prev => prev + 1);
    });
    if (node) observer.current.observe(node);
  }, [isInitialLoading, isFetchingMore, hasMore, activeTab]);

  const loadData = async (tab: LegalTab, query: string = "") => {
    if (tab === LegalTab.ABOUT || tab === LegalTab.STUDY_LAB) {
      setIsInitialLoading(false);
      setHasMore(false);
      return;
    }
    setIsInitialLoading(true);
    setHasMore(true); 
    try {
      let data: any[] = [];
      if (tab === LegalTab.NEWS) data = await fetchLegalNews(1);
      else if (tab === LegalTab.ACADEMY || tab === LegalTab.ARTICLES) data = await fetchAcademyArticles(query, 1);
      else if (tab === LegalTab.TAMIL_NADU) data = await fetchTamilNaduLegalData(1);
      else if (tab === LegalTab.SUPREME_COURT) data = await fetchSupremeCourtData(1);
      else if (tab === LegalTab.JUDGMENTS) data = await fetchLandmarkJudgments(query || "Constitution", 1);
      else if (tab === LegalTab.BARE_ACTS) data = await fetchBareActs(1);

      if (tab === LegalTab.NEWS) setNews(data);
      else if (tab === LegalTab.ACADEMY || tab === LegalTab.ARTICLES) setArticles(data);
      else if (tab === LegalTab.TAMIL_NADU) setTnData(data);
      else if (tab === LegalTab.SUPREME_COURT) setScData(data);
      else if (tab === LegalTab.JUDGMENTS) setJudgments(data);
      else if (tab === LegalTab.BARE_ACTS) setActs(data);
      
      if (data.length < 3) setHasMore(false);
    } finally {
      setIsInitialLoading(false);
    }
  }

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    loadData(activeTab, searchQuery);
  }, [activeTab]);

  const handleOpenViewer = async (title: string, url: string) => {
    setViewerItem({ title, url });
    setExtractedData(null);
    setIsExtracting(true);
    setShowAppearanceMenu(false);
    try {
      const result = await extractResourceContent(title, url);
      setExtractedData(result);
    } catch {
      setExtractedData({ text: "Failed to extract text. Please use the Direct Source Link below.", mentions: [] });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleActJump = (actName: string) => {
    setSearchQuery(actName);
    setActiveTab(LegalTab.BARE_ACTS);
    setViewerItem(null);
    loadData(LegalTab.BARE_ACTS, actName);
  };

  const handleJudgmentJump = (caseName: string) => {
    setSearchQuery(caseName);
    setActiveTab(LegalTab.JUDGMENTS);
    setViewerItem(null);
    loadData(LegalTab.JUDGMENTS, caseName);
  }

  // Process legal content into study materials
  const handleLabGenerate = async () => {
    if (!labInput.trim()) return;
    setIsLabGenerating(true);
    setStudyMaterials(null);
    try {
      const materials = await generateStudyMaterials(labInput);
      setStudyMaterials(materials);
      setLabTab('brief');
    } catch (error) {
      console.error("AI Lab Error:", error);
    } finally {
      setIsLabGenerating(false);
    }
  };

  // Transfer content from reader to study laboratory
  const handlePushToLab = () => {
    if (extractedData?.text) {
      setLabInput(extractedData.text);
      setActiveTab(LegalTab.STUDY_LAB);
      setViewerItem(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getSafeGoogleSearchLink = (title: string) => `https://www.google.com/search?q=${encodeURIComponent(title + " legal source verdictum indiakanoon")}`;

  const SmartTextRenderer: React.FC<{ text: string, mentions: { name: string, type: 'act' | 'judgment' }[] }> = ({ text, mentions }) => {
    if (!mentions.length) return <>{text}</>;

    // Sort mentions by length (descending) to avoid partial matching longer names
    const sortedMentions = [...mentions].sort((a, b) => b.name.length - a.name.length);
    
    // Create a regex that matches any of the mention names
    const escapedNames = sortedMentions.map(m => m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedNames.join('|')})`, 'gi');
    
    const parts = text.split(regex);
    
    return (
      <>
        {parts.map((part, i) => {
          const mention = sortedMentions.find(m => m.name.toLowerCase() === part.toLowerCase());
          if (mention) {
            return (
              <button
                key={i}
                onClick={() => mention.type === 'act' ? handleActJump(mention.name) : handleJudgmentJump(mention.name)}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold text-[0.95em] transition-all transform hover:scale-105 ${
                  mention.type === 'act' 
                    ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                    : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                }`}
              >
                <i className={`fa-solid ${mention.type === 'act' ? 'fa-scroll' : 'fa-scale-balanced'} text-[0.8em]`}></i>
                {part}
              </button>
            );
          }
          return part;
        })}
      </>
    );
  };

  const MindMapNodeView: React.FC<{ node: MindMapNode, level: number }> = ({ node, level }) => (
    <div className={`ml-${level > 0 ? 6 : 0} mt-4`}>
      <div className="flex items-center gap-3">
        <div className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm font-bold text-slate-800 text-[11px] uppercase tracking-wider">{node.label}</div>
      </div>
      {node.children && node.children.length > 0 && (
        <div className="pl-6 border-l border-slate-200 ml-1.5 space-y-4">
          {node.children.map((child, idx) => <MindMapNodeView key={idx} node={child} level={level + 1} />)}
        </div>
      )}
    </div>
  );

  const navigationItems = [
    { id: LegalTab.NEWS, label: 'Current News', icon: 'fa-earth-asia' },
    { id: LegalTab.ARTICLES, label: 'Legal Articles', icon: 'fa-book-open' },
    { id: LegalTab.ACADEMY, label: 'Judiciary Academy', icon: 'fa-landmark-dome' },
    { id: LegalTab.SUPREME_COURT, label: 'SC Observer', icon: 'fa-building-columns' },
    { id: LegalTab.TAMIL_NADU, label: 'Tamil Nadu Hub', icon: 'fa-location-dot' },
    { id: LegalTab.JUDGMENTS, label: 'Landmark Verdicts', icon: 'fa-gavel' },
    { id: LegalTab.BARE_ACTS, label: 'Bare Acts', icon: 'fa-scroll' },
    { id: LegalTab.STUDY_LAB, label: 'AI Study Lab', icon: 'fa-brain' },
    { id: LegalTab.ABOUT, label: 'Firm Profile', icon: 'fa-circle-info' },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row text-slate-900 bg-[#f8f9fa] relative overflow-x-hidden">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-[#020617] text-white flex-shrink-0 flex flex-col shadow-2xl z-[70] transition-transform duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-amber-500 h-10 w-10 rounded-full flex items-center justify-center shadow-lg"><i className="fa-solid fa-moon text-white text-xl"></i></div>
            <h1 className="serif text-xl font-bold tracking-tight">THE MOON <br/><span className="text-amber-500">& OCEAN</span></h1>
          </div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black border-l border-amber-500 pl-3">M&O LAW OFFICE</p>
        </div>
        <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto scrollbar-hide">
          {navigationItems.map(item => (
            <button key={item.id} onClick={() => {setActiveTab(item.id as LegalTab); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-4 px-5 py-4 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${activeTab === item.id ? 'bg-amber-500 text-white shadow-xl shadow-amber-500/20' : 'text-slate-500 hover:bg-slate-900 hover:text-white'}`}>
              <i className={`fa-solid ${item.icon} w-6 text-center text-lg`}></i> {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Nav */}
        <div className="md:hidden flex items-center justify-between px-5 py-4 bg-white border-b border-slate-200 sticky top-0 z-40">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600"><i className="fa-solid fa-bars-staggered text-xl"></i></button>
          <div className="serif font-black text-slate-900 text-base">THE MOON & OCEAN</div>
          <div className="w-10"></div>
        </div>

        {/* Header */}
        <header className="px-8 py-5 border-b border-slate-200 bg-white/95 backdrop-blur-md z-30">
          <div className="max-w-2xl flex items-center gap-4">
             <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-4 py-2 rounded-full border border-amber-100 flex items-center gap-2">
               <i className="fa-solid fa-bolt"></i> Intelligent Legal Hub
             </div>
             {activeTab === LegalTab.BARE_ACTS && (
                <div className="flex-1 relative">
                   <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                   <input 
                     type="text" 
                     placeholder="Search Bare Acts..." 
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && loadData(LegalTab.BARE_ACTS, searchQuery)}
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-2.5 text-sm outline-none focus:border-amber-500 transition-all"
                   />
                </div>
             )}
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto pb-24 md:pb-12 scroll-smooth">
          <div className="max-w-5xl mx-auto p-5 md:p-10">
            {isInitialLoading ? (
              <div className="flex flex-col items-center justify-center h-[60vh]">
                <div className="h-12 w-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                <h3 className="serif text-2xl text-slate-800 font-bold">Synchronizing...</h3>
              </div>
            ) : (
              <div className="space-y-10">
                {activeTab === LegalTab.STUDY_LAB && (
                  <div className="space-y-8 animate-fade-in">
                    <div className="bg-[#020617] rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-10 opacity-10"><i className="fa-solid fa-brain text-[10rem]"></i></div>
                      <div className="relative z-10">
                        <h3 className="serif text-4xl font-bold mb-4">AI Study Laboratory</h3>
                        <p className="text-slate-400 text-sm mb-8 max-w-xl">Deep analysis engine for advocates. Push content from the viewer or paste manual provisions to generate briefings, cards, and maps.</p>
                        
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <select value={labSubject} onChange={(e) => setLabSubject(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest outline-none focus:border-amber-500 transition-colors">
                              <option>Constitutional Law</option>
                              <option>CrPC / BNSS</option>
                              <option>IPC / BNS</option>
                              <option>Property Law</option>
                              <option>Family Law</option>
                            </select>
                            <button onClick={() => setLabInput("")} className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest outline-none hover:bg-slate-800 transition-colors">Clear Workspace</button>
                          </div>
                          <textarea 
                            placeholder="Paste legal provision or judgment text here..." 
                            value={labInput} 
                            onChange={(e) => setLabInput(e.target.value)} 
                            className="w-full bg-slate-900 border border-slate-800 rounded-[2rem] px-8 py-6 text-sm h-48 outline-none focus:border-amber-500 resize-none font-medium leading-relaxed"
                          />
                          <button 
                            onClick={handleLabGenerate} 
                            disabled={isLabGenerating || !labInput.trim()} 
                            className="w-full bg-gradient-to-r from-amber-600 to-amber-500 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-2xl shadow-amber-600/30 active:scale-[0.98] transition-all disabled:opacity-50"
                          >
                            {isLabGenerating ? <span className="flex items-center justify-center gap-3"><i className="fa-solid fa-gear fa-spin"></i> Processing Intelligence...</span> : "Generate Analysis Report"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {studyMaterials && (
                      <div className="space-y-8 animate-slide-up">
                         <div className="flex bg-slate-200 p-1.5 rounded-2xl md:w-fit">
                            <button onClick={() => setLabTab('brief')} className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${labTab === 'brief' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Intelligence Brief</button>
                            <button onClick={() => setLabTab('flash')} className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${labTab === 'flash' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Flashcards</button>
                            <button onClick={() => setLabTab('map')} className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${labTab === 'map' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Mind Map</button>
                         </div>

                         {labTab === 'brief' && (
                            <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 space-y-10">
                               <div className="space-y-6">
                                  <h4 className="text-sm font-black text-amber-600 uppercase tracking-widest flex items-center gap-3"><i className="fa-solid fa-list-check"></i> Key Provisions</h4>
                                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     {studyMaterials.briefing.provisions.map((p, i) => (
                                       <li key={i} className="bg-slate-50 p-5 rounded-2xl border-l-4 border-amber-500 font-bold text-slate-800 text-sm">{p}</li>
                                     ))}
                                  </ul>
                               </div>
                               <div className="space-y-6">
                                  <h4 className="text-sm font-black text-indigo-600 uppercase tracking-widest flex items-center gap-3"><i className="fa-solid fa-gavel"></i> Arguments for Advocates</h4>
                                  <div className="space-y-4">
                                     {studyMaterials.briefing.arguments.map((a, i) => (
                                       <div key={i} className="flex gap-4 items-start">
                                          <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 text-[10px] font-bold">{i+1}</div>
                                          <p className="text-slate-600 text-sm leading-relaxed">{a}</p>
                                       </div>
                                     ))}
                                  </div>
                               </div>
                               <div className="pt-8 border-t border-slate-100">
                                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Summary Conclusion</h4>
                                  <p className="text-slate-500 italic text-sm leading-relaxed">"{studyMaterials.briefing.conclusion}"</p>
                               </div>
                            </div>
                         )}

                         {labTab === 'flash' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                               {studyMaterials.flashcards.map((card, idx) => (
                                 <div key={idx} onClick={() => setFlippedCardIndex(flippedCardIndex === idx ? null : idx)} className="h-64 perspective cursor-pointer">
                                    <div className={`relative w-full h-full transition-all duration-500 preserve-3d ${flippedCardIndex === idx ? 'rotate-y-180' : ''}`}>
                                      <div className="absolute inset-0 bg-white rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-md border border-slate-100 backface-hidden">
                                         <span className="text-[10px] font-black text-amber-500 uppercase mb-4 tracking-widest">Question {idx + 1}</span>
                                         <p className="text-sm font-bold text-slate-800">{card.question}</p>
                                         <span className="mt-8 text-[8px] font-black text-slate-300 uppercase tracking-[0.3em]">Tap to Reveal</span>
                                      </div>
                                      <div className="absolute inset-0 bg-[#020617] text-white rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-2xl rotate-y-180 backface-hidden">
                                         <span className="text-[10px] font-black text-amber-500 uppercase mb-4 tracking-widest">The Rule</span>
                                         <p className="text-xs font-medium leading-relaxed">{card.answer}</p>
                                      </div>
                                    </div>
                                 </div>
                               ))}
                            </div>
                         )}

                         {labTab === 'map' && (
                            <div className="bg-slate-100 rounded-[3rem] p-10 min-h-[400px] shadow-inner overflow-x-auto">
                               <MindMapNodeView node={studyMaterials.mindMap} level={0} />
                            </div>
                         )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === LegalTab.ABOUT && (
                  <div className="space-y-12 animate-fade-in">
                    <div className="relative bg-[#020617] rounded-[3rem] overflow-hidden p-12 text-white shadow-2xl">
                      <div className="absolute top-0 right-0 opacity-10 -mr-20 -mt-20">
                         <i className="fa-solid fa-gavel text-[20rem]"></i>
                      </div>
                      <div className="relative z-10">
                        <h2 className="serif text-4xl md:text-5xl font-bold mb-6 leading-tight">
                          M.SAMEER & <br/>G.SHANMATHI <br/>
                          <span className="text-amber-500">ADVOCATES</span>
                        </h2>
                        <p className="text-[11px] font-black text-amber-500 uppercase tracking-[0.3em] mb-8 border-l-2 border-amber-500 pl-4">
                          LEGAL CONSULTANTS | INVESTORS | PRACTICING AT MADRAS HIGH COURT & DISTRICT COURTS IN TAMILNADU
                        </p>
                        <div className="h-1 w-24 bg-amber-500/30 mb-8 rounded-full"></div>
                        <p className="text-slate-300 text-base md:text-lg leading-relaxed mb-10 max-w-3xl">
                          Experienced legal professionals offering comprehensive services in Negotiation, Property Law, Family Law, and Criminal Defense Law. Proficient in Financial Advisory, Wills Planning Law, Property Management, Business Law, Divorce Law, and Legal Consulting. Dedicated to delivering tailored legal solutions in Tiruchirappalli, & Chennai and across Tamil Nadu, focusing on client empowerment, confidentiality, and reliable guidance across a wide range of matters. Committed to client satisfaction and ethical practice.
                        </p>
                        <div className="flex flex-wrap gap-4">
                           <a href="mailto:adv.sameer.m@gmail.com" className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-3">
                             <i className="fa-solid fa-envelope text-amber-600"></i> adv.sameer.m@gmail.com
                           </a>
                           <a href="tel:9710440728" className="bg-slate-800 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-700 flex items-center gap-3">
                             <i className="fa-solid fa-phone text-amber-500"></i> 9710440728
                           </a>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                       <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 group hover:border-amber-500 transition-all">
                          <div className="h-16 w-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-amber-500 group-hover:text-white transition-all"><i className="fa-solid fa-shield-halved text-2xl"></i></div>
                          <h3 className="serif text-2xl font-bold mb-4">Core Integrity</h3>
                          <p className="text-slate-500 text-sm leading-relaxed">Upholding the highest standards of professional ethics in every legal proceeding across Tamil Nadu.</p>
                       </div>
                       <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 group hover:border-amber-500 transition-all">
                          <div className="h-16 w-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-indigo-600 group-hover:text-white transition-all"><i className="fa-solid fa-microscope text-2xl"></i></div>
                          <h3 className="serif text-2xl font-bold mb-4">Strategic Advice</h3>
                          <p className="text-slate-500 text-sm leading-relaxed">Providing reliable guidance and tailored legal solutions focusing on client empowerment.</p>
                       </div>
                       <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 group hover:border-amber-500 transition-all">
                          <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-emerald-600 group-hover:text-white transition-all"><i className="fa-solid fa-handshake text-2xl"></i></div>
                          <h3 className="serif text-2xl font-bold mb-4">Client Satisfaction</h3>
                          <p className="text-slate-500 text-sm leading-relaxed">Ensuring absolute confidentiality and delivering success in a wide range of legal matters.</p>
                       </div>
                    </div>

                    <div className="bg-white rounded-[3rem] border border-slate-100 p-12 shadow-xl">
                       <h3 className="serif text-3xl font-bold mb-10 text-center">Expertise & Proficiencies</h3>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                          {[
                            'Negotiation', 'Property Law', 'Family Law', 'Criminal Defense', 
                            'Financial Advisory', 'Wills Planning', 'Property Management', 'Business Law', 
                            'Divorce Law', 'Legal Consulting', 'Civil Litigation', 'Investors Advisory'
                          ].map(domain => (
                            <div key={domain} className="bg-slate-50 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-700 text-center border border-slate-100 hover:bg-white hover:shadow-lg transition-all">{domain}</div>
                          ))}
                       </div>
                    </div>
                    
                    <div className="p-10 bg-amber-50 rounded-[3rem] border border-amber-100 flex flex-col md:flex-row items-center justify-between gap-8">
                       <div className="flex-1">
                          <h4 className="serif text-2xl font-bold text-slate-900 mb-2">Primary Locations</h4>
                          <p className="text-slate-600 text-sm">Serving clients in <span className="font-bold">Tiruchirappalli, Chennai,</span> and throughout <span className="font-bold">Tamil Nadu</span>.</p>
                       </div>
                       <div className="flex gap-4">
                          <i className="fa-solid fa-location-dot text-amber-500 text-3xl"></i>
                       </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-8">
                  {/* News Cards */}
                  {activeTab === LegalTab.NEWS && news.map((item, i) => (
                    <div key={i} className="bg-white rounded-[2rem] p-8 border border-white shadow-sm hover:shadow-xl transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <span className="bg-[#020617] text-white text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">{item.source}</span>
                        <span className="text-[10px] text-slate-400 font-bold">{item.date}</span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-4 group-hover:text-amber-600 transition-colors">{item.title}</h3>
                      <p className="text-slate-500 text-sm mb-6 line-clamp-2">{item.summary}</p>
                      <div className="mb-8 flex flex-wrap gap-4">
                         <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2 hover:underline"><i className="fa-solid fa-link"></i> Website: {new URL(item.url).hostname}</a>
                         <a href={getSafeGoogleSearchLink(item.title)} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 hover:underline hover:text-amber-600"><i className="fa-solid fa-magnifying-glass"></i> Alternative Search</a>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <button onClick={() => handleOpenViewer(item.title, item.url)} className="bg-amber-500 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">Read In-App</button>
                        <button onClick={() => shareOnWhatsApp(item.title, item.url)} className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all"><i className="fa-brands fa-whatsapp text-xl"></i></button>
                      </div>
                    </div>
                  ))}

                  {/* Articles/Academy/TN/SC Cards */}
                  {(activeTab === LegalTab.ARTICLES || activeTab === LegalTab.ACADEMY || activeTab === LegalTab.TAMIL_NADU || activeTab === LegalTab.SUPREME_COURT) && 
                   (activeTab === LegalTab.TAMIL_NADU ? tnData : activeTab === LegalTab.SUPREME_COURT ? scData : articles).map((item, i) => (
                    <div key={i} className="bg-white rounded-[2rem] p-8 border border-white shadow-sm flex flex-col md:flex-row gap-8 items-start hover:shadow-xl transition-all">
                      <div className="h-20 w-20 bg-amber-50 rounded-[2rem] flex items-center justify-center shrink-0 shadow-inner"><i className="fa-solid fa-feather-pointed text-3xl text-amber-500"></i></div>
                      <div className="flex-1 w-full">
                        <h3 className="text-2xl font-bold text-slate-900 mb-2 leading-tight">{item.title}</h3>
                        <p className="text-[10px] font-black text-amber-600 mb-6 uppercase tracking-widest">{item.author} • {item.source}</p>
                        <p className="text-sm text-slate-500 mb-6 line-clamp-3 leading-relaxed">{item.summary}</p>
                        <div className="mb-8 flex flex-wrap gap-4">
                           <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2 hover:underline"><i className="fa-solid fa-link"></i> Source Portal: {new URL(item.url).hostname}</a>
                           <a href={getSafeGoogleSearchLink(item.title)} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 hover:underline hover:text-amber-600"><i className="fa-solid fa-magnifying-glass"></i> Alternative Search</a>
                        </div>
                        <div className="flex flex-wrap gap-4">
                          <button onClick={() => handleOpenViewer(item.title, item.url)} className="bg-[#020617] text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest">Analyze Record</button>
                          {item.downloadUrl && <a href={item.downloadUrl} target="_blank" rel="noopener noreferrer" className="bg-indigo-700 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-700/20"><i className="fa-solid fa-download"></i> Direct PDF</a>}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Judgments */}
                  {activeTab === LegalTab.JUDGMENTS && judgments.map((item, i) => (
                    <div key={i} className="bg-white rounded-[3rem] border border-slate-100 shadow-lg overflow-hidden transition-all hover:shadow-2xl">
                      <div className="bg-[#020617] p-10 flex justify-between items-center">
                        <div><h3 className="text-2xl font-black text-white leading-tight">{item.caseName}</h3><span className="text-[10px] text-amber-500 font-black tracking-widest uppercase bg-amber-500/10 px-3 py-1 rounded-full">{item.citation}</span></div>
                        <button onClick={() => handleOpenViewer(item.caseName, item.link)} className="bg-amber-500 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl shadow-amber-500/20">Read Analysis</button>
                      </div>
                      <div className="p-10 space-y-8">
                        <p className="text-xl text-slate-900 font-bold leading-relaxed">{item.summary}</p>
                        
                        {item.relatedActs && item.relatedActs.length > 0 && (
                          <div className="space-y-4">
                             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Related Statutes</h4>
                             <div className="flex flex-wrap gap-2">
                               {item.relatedActs.map((act, idx) => (
                                 <button 
                                   key={idx} 
                                   onClick={() => handleActJump(act)} 
                                   className="px-4 py-2 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-lg border border-slate-200 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all shadow-sm"
                                 >
                                   <i className="fa-solid fa-book-bookmark mr-2"></i> {act}
                                 </button>
                               ))}
                             </div>
                          </div>
                        )}

                        <div className="mb-4 flex flex-wrap gap-4">
                           <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2 hover:underline"><i className="fa-solid fa-link"></i> Legal Portal Source</a>
                           <a href={getSafeGoogleSearchLink(item.caseName)} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 hover:underline hover:text-amber-600"><i className="fa-solid fa-magnifying-glass"></i> Alternative Search</a>
                        </div>
                        <div className="flex flex-wrap gap-4">
                           {item.freeDownloadLink && <a href={item.freeDownloadLink} target="_blank" rel="noopener noreferrer" className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-600/20"><i className="fa-solid fa-file-pdf"></i> Download PDF</a>}
                           <button onClick={() => shareOnWhatsApp(item.caseName, item.link)} className="px-8 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-[10px] uppercase text-emerald-600 flex items-center gap-2"><i className="fa-brands fa-whatsapp"></i> Share citation</button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Bare Acts */}
                  {activeTab === LegalTab.BARE_ACTS && acts.map((item, i) => (
                    <div key={i} className="bg-white p-10 rounded-[3rem] shadow-xl border border-white hover:border-amber-400 transition-all">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h3 className="text-3xl font-black text-slate-900 mb-1 leading-none">{item.name}</h3>
                          <span className="text-[11px] font-black text-amber-600 uppercase tracking-widest">Enacted: {item.year}</span>
                        </div>
                        <i className="fa-solid fa-scroll text-slate-100 text-5xl"></i>
                      </div>
                      <p className="text-slate-400 text-sm mb-10 leading-relaxed line-clamp-3">{item.description}</p>
                      <div className="flex flex-wrap gap-4">
                         <button onClick={() => handleOpenViewer(item.name, item.sourceUrl)} className="flex-1 min-w-[140px] bg-[#020617] text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-2xl active:scale-[0.98] transition-all">Read Clauses</button>
                         {item.pdfUrl && (
                            <a href={item.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-[140px] bg-red-600 text-white py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest shadow-xl shadow-red-600/20">
                              <i className="fa-solid fa-file-pdf"></i> Download PDF
                            </a>
                         )}
                         <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-[140px] bg-indigo-700 text-white py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-700/20"><i className="fa-solid fa-arrow-up-right-from-square"></i> Official Source</a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Reader Viewer */}
      {viewerItem && (
        <div className="fixed inset-0 bg-white z-[100] flex flex-col animate-fade-in animate-slide-up">
          <div className="h-24 px-8 border-b border-slate-200 flex items-center justify-between bg-white/95 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-6">
              <button onClick={() => setViewerItem(null)} className="h-12 w-12 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-all"><i className="fa-solid fa-xmark text-2xl"></i></button>
              <div className="hidden md:block">
                 <h2 className="serif font-bold text-slate-900 text-base md:text-xl line-clamp-1 max-w-lg">{viewerItem.title}</h2>
                 <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">M&O Intelligent Reader</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <button 
                  onClick={() => setShowAppearanceMenu(!showAppearanceMenu)} 
                  className={`h-12 w-12 rounded-full flex items-center justify-center transition-all ${showAppearanceMenu ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  <i className="fa-solid fa-font text-lg"></i>
                </button>
                
                {showAppearanceMenu && (
                  <div className="absolute top-16 right-0 bg-white border border-slate-200 shadow-2xl rounded-3xl p-6 w-72 animate-fade-in z-20">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Reader Settings</h4>
                    
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-600">
                          <span>FONT SIZE</span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-900">{fontSize}px</span>
                        </div>
                        <div className="flex items-center gap-3">
                           <button onClick={() => setFontSize(Math.max(14, fontSize - 2))} className="h-10 w-10 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"><i className="fa-solid fa-minus text-xs"></i></button>
                           <input type="range" min="14" max="32" step="1" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="flex-1 accent-amber-500 h-1.5 rounded-full cursor-pointer" />
                           <button onClick={() => setFontSize(Math.min(32, fontSize + 2))} className="h-10 w-10 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"><i className="fa-solid fa-plus text-xs"></i></button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-600">
                          <span>LINE SPACING</span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-900">{lineHeight.toFixed(1)}</span>
                        </div>
                        <div className="flex gap-2">
                           {[1.2, 1.6, 2.0].map((lh) => (
                             <button key={lh} onClick={() => setLineHeight(lh)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${lineHeight === lh ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                               {lh === 1.2 ? 'Tight' : lh === 1.6 ? 'Relaxed' : 'Wide'}
                             </button>
                           ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={handlePushToLab} 
                className="hidden md:flex bg-[#020617] text-white px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest items-center gap-2 shadow-2xl active:scale-95 transition-all"
              >
                <i className="fa-solid fa-microscope"></i> Push to Lab
              </button>
              <a href={viewerItem.url} target="_blank" rel="noopener noreferrer" className="bg-slate-100 text-slate-600 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-900 hover:text-white transition-all shadow-md">
                 <i className="fa-solid fa-arrow-up-right-from-square"></i> <span className="hidden sm:inline">Source Link</span>
              </a>
            </div>
          </div>
          
          <div className="flex-1 bg-[#f8f9fa] overflow-y-auto">
            <div className="max-w-4xl mx-auto py-16 px-10 bg-white min-h-screen shadow-2xl border-x border-slate-100">
              <div className="mb-10 pb-10 border-b border-slate-100">
                 <h1 className="serif font-bold text-slate-900 text-3xl md:text-5xl mb-6">{viewerItem.title}</h1>
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <a href={viewerItem.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-100 transition-all w-fit">
                       <i className="fa-solid fa-link"></i> Website: {viewerItem.url}
                    </a>
                 </div>
              </div>
              
              {isExtracting ? (
                 <div className="flex flex-col items-center justify-center h-[40vh]">
                   <div className="h-12 w-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-8"></div>
                   <p className="text-slate-400 font-black text-xs uppercase tracking-[0.3em] animate-pulse">Scanning Provisions...</p>
                 </div>
              ) : extractedData && (
                <div 
                  className="serif text-slate-800 transition-all duration-300"
                  style={{ fontSize: `${fontSize}px`, lineHeight: lineHeight }}
                >
                  {extractedData.text.split('\n').map((line, i) => (
                    <p key={i} className="mb-6">
                      <SmartTextRenderer text={line} mentions={extractedData.mentions} />
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="md:hidden border-t border-slate-200 bg-white p-4 flex gap-3">
             <button onClick={handlePushToLab} className="flex-1 bg-[#020617] text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2">
                <i className="fa-solid fa-microscope"></i> Push to Lab
             </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .animate-slide-up { animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .perspective { perspective: 1500px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #f59e0b;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default App;
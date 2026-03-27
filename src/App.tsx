import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { 
  Camera, 
  Scan, 
  Info, 
  X, 
  ChevronRight, 
  Search, 
  BookOpen, 
  History,
  Apple,
  Leaf,
  Droplets,
  Sun,
  Loader2,
  Heart,
  Share2,
  ExternalLink,
  ArrowRight
} from 'lucide-react';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
import { GoogleGenAI, Type } from "@google/genai";
import { Card, Button, IconButton, InsetContainer, DeepInsetContainer, Modal } from './components/Neumorphic.tsx';
import { FruitImage } from './components/FruitImage.tsx';
import { FruitCard } from './components/FruitCard.tsx';
import { FruitNinja } from './components/FruitNinja.tsx';
import { PullRope } from './components/PullRope.tsx';
import { 
  auth, 
  db, 
  signInWithGoogle, 
  logout, 
  saveFruitToCollection, 
  deleteFruitFromCollection,
  toggleFavoriteFruit,
  FruitEntry,
  FavoriteEntry,
  handleFirestoreError,
  OperationType
} from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { COMMON_FRUITS } from './data/fruits';

// --- Types ---
interface FruitInfo {
  name: string;
  scientificName: string;
  family: string;
  origin: string;
  nutrition: {
    calories: string;
    vitamins: string[];
    minerals: string[];
  };
  funFact: string;
  season: string;
}

interface CollectionItem {
  id: string;
  fruit: FruitInfo;
  image: string;
  date: string;
}

// --- Mock Data ---
const INITIAL_COLLECTION: CollectionItem[] = [
  {
    id: '1',
    fruit: {
      name: '红富士苹果',
      scientificName: 'Malus domestica',
      family: '蔷薇科',
      origin: '日本',
      nutrition: {
        calories: '52 kcal/100g',
        vitamins: ['维生素C', '维生素K'],
        minerals: ['钾', '膳食纤维']
      },
      funFact: '苹果是世界上种植最广泛的水果之一。',
      season: '秋季'
    },
    image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&q=80&w=800',
    date: '2024-03-20'
  },
  {
    id: '2',
    fruit: {
      name: '蒙自石榴',
      scientificName: 'Punica granatum',
      family: '千屈菜科',
      origin: '中亚',
      nutrition: {
        calories: '83 kcal/100g',
        vitamins: ['维生素C', '维生素B6'],
        minerals: ['铁', '镁']
      },
      funFact: '石榴在许多文化中象征着丰饶和多子多福。',
      season: '秋季'
    },
    image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&q=80&w=800',
    date: '2024-03-22'
  }
];

const getCurrentSeason = () => {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return '春季';
  if (month >= 5 && month <= 7) return '夏季';
  if (month >= 8 && month <= 10) return '秋季';
  return '冬季';
};



// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Rope animation hooks
  const ropeY = useMotionValue(0);
  const cardY = useTransform(ropeY, [0, 80], [0, 12]);
  const cardScale = useTransform(ropeY, [0, 80], [1, 0.96]);

  const triggerJackpot = () => {
    window.dispatchEvent(new CustomEvent('fruit-jackpot'));
  };

  const [fruitCollection, setFruitCollection] = useState<CollectionItem[]>([]);
  const [favoriteFruits, setFavoriteFruits] = useState<string[]>([]);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [identifiedFruit, setIdentifiedFruit] = useState<FruitInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [collectionTab, setCollectionTab] = useState<'identified' | 'favorites'>('identified');
  const [encyclopediaSearch, setEncyclopediaSearch] = useState('');
  const [activeFruit, setActiveFruit] = useState<any>(null);
  useEffect(() => {
    if (!activeFruit && COMMON_FRUITS.length > 0) {
      setActiveFruit(COMMON_FRUITS.find(f => f.name.includes('苹果')) || COMMON_FRUITS[0]);
    }
  }, []);
  const [hoveredFruit, setHoveredFruit] = useState<any>(null);
  const [isWallPaused, setIsWallPaused] = useState(false);
  const currentSeason = getCurrentSeason();
  const recommendedFruits = COMMON_FRUITS.filter(fruit => 
    fruit.season.includes(currentSeason) || fruit.season.includes('全年')
  );
  const encyclopediaRef = useRef<HTMLDivElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- Shuffled Rows for Encyclopedia Wall (to prevent flickering) ---
  const shuffledRows = useMemo(() => {
    // 确保每一行都是独立的随机排序
    const shuffle = (array: any[]) => [...array].sort(() => Math.random() - 0.5);
    
    const row1 = shuffle(COMMON_FRUITS);
    const row2 = shuffle(COMMON_FRUITS).reverse();
    const row3 = shuffle(COMMON_FRUITS);
    
    return { row1, row2, row3 };
  }, []); // 空依赖数组确保在组件生命周期内只生成一次，保持稳定

  // --- Auth & Data Sync ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setFruitCollection([]);
      return;
    }

    const path = `users/${user.uid}/collection`;
    const q = query(collection(db, path), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: CollectionItem[] = snapshot.docs.map(doc => {
        const data = doc.data() as FruitEntry;
        return {
          id: doc.id,
          fruit: {
            name: data.fruitName,
            scientificName: data.scientificName || '',
            family: data.family || '',
            origin: data.origin || '',
            nutrition: data.nutrition || { calories: '', vitamins: [], minerals: [] },
            funFact: data.funFact || '',
            season: data.season || ''
          },
          image: data.imageUrl,
          date: data.timestamp?.toDate().toISOString().split('T')[0] || '',
        };
      });
      setFruitCollection(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsubscribe();
  }, [user]);

  // --- Sync Favorites ---
  useEffect(() => {
    if (!user) {
      setFavoriteFruits([]);
      return;
    }

    const path = `users/${user.uid}/favorites`;
    const q = query(collection(db, path));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const names = snapshot.docs.map(doc => (doc.data() as FavoriteEntry).fruitName);
      setFavoriteFruits(names);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsubscribe();
  }, [user]);

  const handleFavoriteToggle = async (e: React.MouseEvent, fruit: any) => {
    e.stopPropagation();
    console.log('handleFavoriteToggle called for:', fruit.name);
    if (!user) {
      // If not logged in, trigger sign in
      signInWithGoogle();
      return;
    }

    const isFavorite = favoriteFruits.includes(fruit.name);
    await toggleFavoriteFruit(user.uid, fruit.name, !isFavorite);
  };

  // --- Camera & AI Logic ---
  const startCamera = async () => {
    setIsCameraOpen(true);
    setCapturedImage(null);
    setIdentifiedFruit(null);
    setError(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('无法访问摄像头，请确保已授予权限。');
      console.error('Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const closeCamera = () => {
    stopCamera();
    setIsCameraOpen(false);
    setCapturedImage(null);
    setIdentifiedFruit(null);
    setError(null);
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Cap resolution for faster processing
      const maxDim = 1024;
      let width = video.videoWidth;
      let height = video.videoHeight;
      
      if (width > height) {
        if (width > maxDim) {
          height *= maxDim / width;
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width *= maxDim / height;
          height = maxDim;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        const imageData = canvas.toDataURL('image/jpeg', 0.7);
        setCapturedImage(imageData);
        stopCamera();
        identifyFruit(imageData);
      }
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setIdentifiedFruit(null);
    setError(null);
    startCamera();
  };

  const [loadingMessage, setLoadingMessage] = useState('AI 正在深度解析中...');

  useEffect(() => {
    if (isIdentifying) {
      const messages = [
        'AI 正在深度解析中...',
        '正在识别水果种类...',
        '正在检索营养成分...',
        '正在生成趣味百科...',
        '即将完成，请稍候...'
      ];
      let i = 0;
      const interval = setInterval(() => {
        i = (i + 1) % messages.length;
        setLoadingMessage(messages[i]);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isIdentifying]);

  const identifyFruit = async (base64Image: string) => {
    setIsIdentifying(true);
    setError(null);
    
    try {
      const response = await fetch('/api/identify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ base64Image }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '识别失败');
      }

      const fruitData = await response.json();
      setIdentifiedFruit(fruitData);
    } catch (err: any) {
      setError(err.message || '未能认出这是什么水果 🤔 试试靠近一点，或者换个明亮的背景再拍一张？');
      console.error('Identification error:', err);
    } finally {
      setIsIdentifying(false);
    }
  };

  const addToCollection = async () => {
    if (!user) {
      signInWithGoogle();
      return;
    }
    if (!identifiedFruit || !capturedImage) return;
    
    try {
      await saveFruitToCollection(user.uid, {
        fruitName: identifiedFruit.name,
        scientificName: identifiedFruit.scientificName,
        family: identifiedFruit.family,
        origin: identifiedFruit.origin,
        nutrition: identifiedFruit.nutrition,
        funFact: identifiedFruit.funFact,
        season: identifiedFruit.season,
        imageUrl: capturedImage
      });
      closeCamera();
    } catch (err) {
      setError('保存失败，请重试。');
      console.error('Save error:', err);
    }
  };

  const filteredCollection = fruitCollection.filter(item => 
    item.fruit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.fruit.family.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const favoriteItems = useMemo(() => {
    return COMMON_FRUITS.filter(fruit => favoriteFruits.includes(fruit.name)).map(fruit => ({
      id: `fav-${fruit.name}`,
      fruit: {
        name: fruit.name,
        scientificName: fruit.scientificName || '',
        family: fruit.family || '',
        origin: fruit.origin || '',
        nutrition: {
          calories: fruit.kcal.toString(),
          vitamins: [],
          minerals: []
        },
        funFact: (fruit as any).description || '',
        season: fruit.season || ''
      },
      image: fruit.image,
      date: '收藏于 ' + new Date().toLocaleDateString()
    }));
  }, [favoriteFruits]);

  const displayCollection = collectionTab === 'identified' ? filteredCollection : favoriteItems.filter(item => 
    item.fruit.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredEncyclopedia = COMMON_FRUITS.filter(fruit => 
    fruit.name.toLowerCase().includes(encyclopediaSearch.toLowerCase()) ||
    fruit.scientificName.toLowerCase().includes(encyclopediaSearch.toLowerCase()) ||
    fruit.family.toLowerCase().includes(encyclopediaSearch.toLowerCase())
  );

  const FRUIT_WALL_ICONS = [
    '🍓', '🍌', '🍉', '🍇', '🍊', '🍍', '🍒', '🍈', '🍏', '🍎', '🌵', '🍐', '🥭', '🍑', '🥑', '🟣', '🥝', '🍋'
  ];

  return (
    <div className="min-h-screen bg-nm-bg text-nm-ink selection:bg-nm-accent selection:text-white pb-20 relative">
      {/* Header */}
      <motion.nav 
        style={{ y: useTransform(ropeY, [0, 80], [0, 50]) }}
        className="fixed top-0 left-0 right-0 z-50 px-6 py-6 pointer-events-none select-none"
      >
        <div className="max-w-7xl mx-auto px-6 py-3 rounded-[24px] bg-white/40 backdrop-blur-xl shadow-nm-flat flex items-center justify-between border border-white/60 pointer-events-auto relative">
          {/* Left: Logo */}
          <div className="flex items-center gap-6 relative">
            <div className="flex items-center gap-2">
              <Apple size={18} className="text-nm-accent" />
              <span className="text-xl font-display font-extrabold tracking-tighter">FruitDex</span>
            </div>
          </div>
          
          {/* Center: Search */}
          <div className="hidden md:flex flex-1 max-w-sm mx-10">
            <div className="bg-nm-bg rounded-2xl shadow-[inset_4px_4px_7px_rgba(163,177,198,0.6),inset_-4px_-4px_7px_rgba(255,255,255,0.5)] !p-0 flex items-center px-4 w-full">
              <Search size={16} className="text-nm-muted ml-3" />
              <input 
                type="text" 
                placeholder="搜索百科全书..." 
                aria-label="搜索百科全书"
                className="w-full bg-transparent border-none focus:ring-0 py-2 px-3 text-xs"
                value={encyclopediaSearch}
                onChange={(e) => setEncyclopediaSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Right: Login/History */}
          <div className="flex items-center gap-4 relative ml-auto md:ml-0">
            {user ? (
              <div className="relative">
                <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  aria-label="用户菜单"
                  className="flex items-center gap-2 p-1 rounded-full hover:bg-white/20 transition-colors"
                >
                  <img src={user.photoURL || ''} className="w-8 h-8 rounded-full shadow-nm-sm border-2 border-white/40" alt="Profile" referrerPolicy="no-referrer" />
                </button>
                
                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-56 rounded-3xl bg-nm-bg shadow-nm-flat border border-white/40 overflow-hidden z-[60]"
                    >
                      <div className="p-5 border-b border-nm-ink/5">
                        <p className="text-sm font-bold text-nm-ink truncate">{user.displayName}</p>
                        <p className="text-[10px] text-nm-muted truncate">{user.email}</p>
                      </div>
                      <div className="p-2">
                        <button 
                          onClick={() => {
                            logout();
                            setIsUserMenuOpen(false);
                          }}
                          aria-label="退出登录"
                          className="w-full p-3 text-left text-xs text-red-500 hover:bg-red-500/10 rounded-2xl transition-colors flex items-center gap-2"
                        >
                          <X size={14} /> 退出登录
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Button onClick={signInWithGoogle} className="!px-4 !py-2 text-xs !shadow-nm-sm">登录</Button>
            )}
            <IconButton aria-label="历史记录" className="!w-10 !h-10 !shadow-none !bg-transparent">
              <History size={18} />
            </IconButton>
          </div>
        </div>
      </motion.nav>
      
      {/* Pull Rope below Nav */}
      <motion.div 
        style={{ y: useTransform(ropeY, [0, 80], [0, 50]) }}
        className="fixed top-[91px] left-0 right-0 z-40 pointer-events-none hidden md:block"
      >
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="absolute left-6 ml-6 pl-5 pointer-events-auto">
            <PullRope dragY={ropeY} onTrigger={triggerJackpot} />
          </div>
        </div>
      </motion.div>

      {/* Hero Section */}
      <section className="relative pt-[120px] md:pt-[188px] px-6 pb-12 overflow-hidden min-h-[500px] md:min-h-[600px] flex items-center justify-center">
        <FruitNinja />
        <div className="max-w-7xl mx-auto relative z-10 pointer-events-none">
          <div className="flex flex-col items-center text-center mb-16 pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <motion.div
                style={{ y: cardY, scale: cardScale }}
                className="max-w-2xl p-8 relative select-none"
              >
                <h1 className="text-3xl md:text-5xl font-display font-extrabold tracking-tighter mb-6 leading-[0.95]">
                  <span className="font-serif italic font-medium tracking-normal">Discover Nature,</span><br />
                  <span className="text-nm-accent font-serif italic font-medium tracking-normal mt-1 block">A Botanical Journey</span>
                </h1>
                <p className="text-nm-muted text-base mb-8 leading-relaxed">
                  FruitDex 是一个基于 AI 的水果科普平台。我们利用最新的视觉识别技术，帮助用户快速了解身边的水果，探索自然界的奥秘。
                </p>
                
                <div className="flex flex-wrap justify-center gap-4 mb-8">
                  <Button 
                    variant="primary" 
                    className="!px-8 !py-3 text-base shadow-nm-flat"
                    onClick={startCamera}
                  >
                    <Scan size={20} />
                    拍照识果
                  </Button>
                  <Button 
                    className="!px-8 !py-3 text-base"
                    onClick={() => {
                      const wall = document.querySelector('.marquee-container');
                      wall?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  >
                    <BookOpen size={20} />
                    水果百科
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap justify-center gap-x-16 gap-y-8 pt-20 mt-[-12px] border-t border-nm-ink/5 pointer-events-auto"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-nm-accent/10 flex items-center justify-center shrink-0 shadow-nm-sm">
                <Scan size={24} className="text-nm-accent" />
              </div>
              <div>
                <p className="text-sm font-bold text-nm-ink uppercase tracking-wider">AI 视觉识别</p>
                <p className="text-[11px] text-nm-muted">毫秒级精准识别全球水果</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-nm-accent/10 flex items-center justify-center shrink-0 shadow-nm-sm">
                <BookOpen size={24} className="text-nm-accent" />
              </div>
              <div>
                <p className="text-sm font-bold text-nm-ink uppercase tracking-wider">权威百科</p>
                <p className="text-[11px] text-nm-muted">深度解析历史、营养与趣味</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-nm-accent/10 flex items-center justify-center shrink-0 shadow-nm-sm">
                <History size={24} className="text-nm-accent" />
              </div>
              <div>
                <p className="text-sm font-bold text-nm-ink uppercase tracking-wider">云端收藏</p>
                <p className="text-[11px] text-nm-muted">随时随地查看你的探索足迹</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Scrolling Common Fruits Section */}
      <section className="px-6 py-24 md:py-32 border-t border-nm-ink/5">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-4 mb-12">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="h-6 md:h-8 w-1.5 bg-nm-accent rounded-full shrink-0" />
              <h2 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-display font-extrabold tracking-tighter">
                每日水果推荐 <span className="inline-block text-nm-muted text-xs md:text-sm font-normal tracking-normal">({currentSeason}时令)</span>
              </h2>
            </div>
          </div>
          
          <div className={`relative w-full overflow-hidden py-12 marquee-container ${isWallPaused ? 'marquee-paused' : ''} ${hoveredFruit ? 'has-hovered-fruit' : ''}`}>
            <div 
              className={`flex gap-10 animate-marquee whitespace-nowrap ${encyclopediaSearch ? '[animation-play-state:paused]' : ''}`}
              style={{ animationDuration: `${(encyclopediaSearch ? filteredEncyclopedia.length : recommendedFruits.length * 3) * 5}s` }}
            >
              {(encyclopediaSearch ? filteredEncyclopedia : [...recommendedFruits, ...recommendedFruits, ...recommendedFruits]).map((fruit, idx) => (
                <FruitCard 
                  key={idx}
                  fruit={fruit}
                  isActive={activeFruit?.name === fruit.name}
                  isHovered={hoveredFruit?.name === fruit.name}
                  isFavorite={favoriteFruits.includes(fruit.name)}
                  onFavoriteToggle={(e) => handleFavoriteToggle(e, fruit)}
                  onMouseEnter={() => {
                    console.log('Hovering fruit:', fruit.name);
                    setHoveredFruit(fruit);
                    setIsWallPaused(true);
                  }}
                  onMouseLeave={() => {
                    console.log('Leaving fruit:', fruit.name);
                    setHoveredFruit(null);
                    setIsWallPaused(false);
                  }}
                  onClick={(e) => {
                    console.log('Fruit card clicked:', fruit.name);
                    e.stopPropagation();
                    setActiveFruit(fruit);
                    setIsWallPaused(true);
                    setTimeout(() => {
                      console.log('Scrolling to encyclopedia');
                      encyclopediaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }}
                />
              ))}
            </div>
            
            {/* Gradient Overlays for smooth fade within the container */}
            <div className="absolute inset-y-0 left-0 w-12 md:w-32 bg-gradient-to-r from-nm-bg to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-12 md:w-32 bg-gradient-to-l from-nm-bg to-transparent z-10 pointer-events-none" />
          </div>
        </div>
      </section>

      {/* Collection Grid */}
      <section className="px-6 py-32 border-t border-nm-ink/5">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-16">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="h-6 md:h-8 w-1.5 bg-nm-accent rounded-full shrink-0" />
                <h2 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-display font-extrabold tracking-tighter">我的探索</h2>
              </div>
              <div className="flex gap-2 p-1 rounded-2xl bg-nm-bg shadow-nm-inset w-fit">
                <button 
                  onClick={() => setCollectionTab('identified')}
                  className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${collectionTab === 'identified' ? 'bg-white shadow-nm-sm text-nm-accent' : 'text-nm-muted hover:text-nm-ink'}`}
                >
                  我的收集
                </button>
                <button 
                  onClick={() => setCollectionTab('favorites')}
                  className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${collectionTab === 'favorites' ? 'bg-white shadow-nm-sm text-nm-accent' : 'text-nm-muted hover:text-nm-ink'}`}
                >
                  我的收藏
                </button>
              </div>
            </div>
            <div className="relative flex-1 max-w-md">
              <InsetContainer className="!p-0 flex items-center px-4">
                <Search size={18} className="text-nm-muted ml-3" />
                <input 
                  type="text" 
                  placeholder={collectionTab === 'identified' ? "搜索我的收集..." : "搜索我的收藏..."} 
                  className="w-full bg-transparent border-none focus:ring-0 py-3 px-3 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </InsetContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {displayCollection.length > 0 ? displayCollection.map((item) => (
              <motion.div
                key={item.id}
                layoutId={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="group"
                onClick={() => setSelectedItem(item as any)}
              >
                <Card className="overflow-hidden !p-0 border border-white/20 cursor-pointer h-full">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <FruitImage 
                      name={item.fruit.name} 
                      fallbackImage={item.image} 
                      className="w-full h-full"
                    />
                    <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/50 text-white text-xs font-medium">
                      {item.date}
                    </div>
                  </div>
                  <div className="p-6 pl-9">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-xl font-bold">{item.fruit.name}</h3>
                        <p className="text-xs text-nm-muted italic">{item.fruit.scientificName}</p>
                      </div>
                      <span className="px-2 py-1 rounded-lg bg-nm-accent/10 text-nm-accent text-[10px] font-bold uppercase tracking-wider">
                        {item.fruit.family}
                      </span>
                    </div>
                    <p className="text-sm text-nm-muted line-clamp-2 mb-4">
                      {item.fruit.funFact}
                    </p>
                    <div className="flex gap-4 border-t border-nm-ink/5 pt-4">
                      <div className="flex items-center gap-1 text-xs text-nm-muted">
                        <Droplets size={14} className="text-blue-400" />
                        {item.fruit.nutrition.calories}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-nm-muted">
                        <Sun size={14} className="text-orange-400" />
                        {item.fruit.season}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )) : (
              <div className="col-span-full py-20 text-center">
                <div className="w-20 h-20 bg-nm-bg shadow-nm-inset rounded-full flex items-center justify-center mx-auto mb-6">
                  <Apple size={32} className="text-nm-muted opacity-20" />
                </div>
                <p className="text-nm-muted">
                  {user ? '你的收集库空空如也，快去识别第一颗水果吧！' : '登录后即可查看你的私人水果收集库。'}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Camera Modal */}
      <AnimatePresence>
        {isCameraOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-nm-bg/95 backdrop-blur-xl flex flex-col items-center justify-center p-6"
          >
            <div className="w-full max-w-2xl flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold">识别水果</h3>
                <IconButton aria-label="关闭摄像头" onClick={closeCamera}><X size={24} /></IconButton>
              </div>

              <div className="relative aspect-square md:aspect-video rounded-[32px] overflow-hidden bg-black shadow-nm-inset border-4 border-white/20">
                {!capturedImage ? (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img src={capturedImage} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                )}
                
                {isIdentifying && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <Loader2 className="animate-spin mb-4 drop-shadow-lg" size={48} />
                    <p className="font-medium drop-shadow-lg">{loadingMessage}</p>
                  </div>
                )}

                {/* Scan Animation */}
                {!capturedImage && !isIdentifying && (
                  <motion.div 
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute left-0 right-0 h-1.5 bg-nm-accent shadow-[0_0_25px_rgba(108,99,255,1)] z-10"
                  />
                )}
              </div>

              {error && (
                <div className="p-4 rounded-2xl bg-red-500/10 text-red-500 text-sm text-center border border-red-500/20">
                  {error}
                </div>
              )}

              {identifiedFruit ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-6"
                >
                  <Card className="!bg-white/50 border border-white/40">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                      <div className="flex-1">
                        <h4 className="text-2xl font-bold text-nm-accent truncate">{identifiedFruit.name}</h4>
                        <p className="text-sm text-nm-muted italic truncate">{identifiedFruit.scientificName}</p>
                      </div>
                      <div className="sm:text-right shrink-0">
                        <p className="text-[10px] font-bold uppercase text-nm-muted tracking-widest">原产地</p>
                        <p className="font-medium">{identifiedFruit.origin}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="p-3 rounded-2xl bg-nm-bg shadow-nm-inset">
                        <p className="text-[10px] font-bold text-nm-muted uppercase mb-1">营养价值</p>
                        <p className="text-xs font-medium">{identifiedFruit.nutrition.calories}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {identifiedFruit.nutrition.vitamins.slice(0, 2).map(v => (
                            <span key={v} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">{v}</span>
                          ))}
                        </div>
                      </div>
                      <div className="p-3 rounded-2xl bg-nm-bg shadow-nm-inset">
                        <p className="text-[10px] font-bold text-nm-muted uppercase mb-1">趣味百科</p>
                        <p className="text-[10px] leading-tight line-clamp-3">{identifiedFruit.funFact}</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <Button variant="primary" className="flex-1" onClick={addToCollection}>
                        {user ? '加入收集库' : '登录以保存'}
                      </Button>
                      <Button className="flex-1" onClick={retakePhoto}>
                        重新拍照
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ) : (
                <div className="flex justify-center">
                  {!capturedImage && (
                    <Button 
                      variant="primary" 
                      className="!w-20 !h-20 !rounded-full shadow-nm-flat"
                      onClick={captureImage}
                    >
                      <Camera size={32} />
                    </Button>
                  )}
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <Modal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)}>
        {selectedItem && (
          <div className="flex flex-col lg:flex-row gap-10">
            <div className="flex-1">
              <FruitImage 
                name={selectedItem.fruit.name} 
                fallbackImage={selectedItem.image} 
                className="w-full h-auto max-h-[60vh] rounded-[32px] shadow-nm-flat"
              />
            </div>
            <div className="w-full lg:w-96 flex flex-col">
              <div className="mb-6">
                <span className="px-3 py-1 rounded-full bg-nm-accent/10 text-nm-accent text-xs font-bold uppercase tracking-widest mb-4 inline-block">
                  {selectedItem.fruit.family}
                </span>
                <h2 className="text-4xl font-display font-extrabold tracking-tighter mb-2">{selectedItem.fruit.name}</h2>
                <p className="text-nm-muted italic mb-6">{selectedItem.fruit.scientificName}</p>
                <p className="text-nm-muted leading-relaxed mb-8">{selectedItem.fruit.funFact}</p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="p-4 rounded-2xl bg-nm-bg shadow-nm-inset">
                  <p className="text-[10px] font-bold text-nm-muted uppercase tracking-widest mb-2">营养成分</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.fruit.nutrition.vitamins.map(v => (
                      <span key={v} className="px-2 py-1 rounded-lg bg-white/50 text-xs font-medium">{v}</span>
                    ))}
                    {selectedItem.fruit.nutrition.minerals.map(m => (
                      <span key={m} className="px-2 py-1 rounded-lg bg-white/50 text-xs font-medium">{m}</span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-nm-bg shadow-nm-inset">
                    <p className="text-[10px] font-bold text-nm-muted uppercase tracking-widest mb-1">热量</p>
                    <p className="text-sm font-bold">{selectedItem.fruit.nutrition.calories}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-nm-bg shadow-nm-inset">
                    <p className="text-[10px] font-bold text-nm-muted uppercase tracking-widest mb-1">成熟季节</p>
                    <p className="text-sm font-bold">{selectedItem.fruit.season}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-auto">
                <Button variant="primary" className="flex-1">
                  分享百科 <Share2 size={18} />
                </Button>
                <IconButton aria-label="收藏"><Heart size={20} /></IconButton>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Fruit Encyclopedia Wall */}
      <section className="py-32 overflow-hidden bg-nm-bg/30 marquee-container border-t border-nm-ink/5">
        <div className="max-w-7xl mx-auto px-6 text-center mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-5xl md:text-7xl font-display font-extrabold tracking-tighter mb-6">
              全球水果<span className="text-nm-accent">品种</span>大百科
            </h2>
            <p className="text-nm-muted text-lg max-w-3xl mx-auto leading-relaxed">
              FruitDex 收录了全球各地最具代表性的细分品种，从历史渊源到营养价值，带你深入了解每一颗果实背后的故事。只有真实科普，没有虚假信息。
            </p>
          </motion.div>
        </div>

        <div className={`space-y-8 relative ${isWallPaused ? 'marquee-paused' : ''}`}>
          {/* Row 1 */}
          <div 
            className={`flex gap-10 animate-marquee whitespace-nowrap cursor-pointer ${hoveredFruit ? 'has-hovered-fruit' : ''}`}
            style={{ animationDuration: `${shuffledRows.row1.length * 2 * 5 + 3}s` }}
          >
            {[...shuffledRows.row1, ...shuffledRows.row1].map((fruit, i) => (
              <FruitCard 
                key={`row1-${i}`}
                fruit={fruit}
                isActive={activeFruit?.name === fruit.name}
                isHovered={hoveredFruit?.name === fruit.name}
                isFavorite={favoriteFruits.includes(fruit.name)}
                onFavoriteToggle={(e) => handleFavoriteToggle(e, fruit)}
                onMouseEnter={() => {
                  setHoveredFruit(fruit);
                  setIsWallPaused(true);
                }}
                onMouseLeave={() => {
                  setHoveredFruit(null);
                  setIsWallPaused(false);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveFruit(fruit);
                  setIsWallPaused(true);
                  setTimeout(() => {
                    encyclopediaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }}
              />
            ))}
          </div>
          {/* Row 2 */}
          <div 
            className={`flex gap-10 animate-marquee-reverse whitespace-nowrap cursor-pointer ${hoveredFruit ? 'has-hovered-fruit' : ''}`}
            style={{ animationDuration: `${shuffledRows.row2.length * 2 * 5 + 3}s` }}
          >
            {[...shuffledRows.row2, ...shuffledRows.row2].map((fruit, i) => (
              <FruitCard 
                key={`row2-${i}`}
                fruit={fruit}
                isActive={activeFruit?.name === fruit.name}
                isHovered={hoveredFruit?.name === fruit.name}
                isFavorite={favoriteFruits.includes(fruit.name)}
                onFavoriteToggle={(e) => handleFavoriteToggle(e, fruit)}
                onMouseEnter={() => {
                  setHoveredFruit(fruit);
                  setIsWallPaused(true);
                }}
                onMouseLeave={() => {
                  setHoveredFruit(null);
                  setIsWallPaused(false);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveFruit(fruit);
                  setIsWallPaused(true);
                  setTimeout(() => {
                    encyclopediaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }}
              />
            ))}
          </div>
          {/* Row 3 */}
          <div 
            className={`flex gap-10 animate-marquee whitespace-nowrap cursor-pointer ${hoveredFruit ? 'has-hovered-fruit' : ''}`}
            style={{ animationDuration: `${shuffledRows.row3.length * 2 * 5 + 3}s` }}
          >
            {[...shuffledRows.row3, ...shuffledRows.row3].map((fruit, i) => (
              <FruitCard 
                key={`row3-${i}`}
                fruit={fruit}
                isActive={activeFruit?.name === fruit.name}
                isHovered={hoveredFruit?.name === fruit.name}
                isFavorite={favoriteFruits.includes(fruit.name)}
                onFavoriteToggle={(e) => handleFavoriteToggle(e, fruit)}
                onMouseEnter={() => {
                  setHoveredFruit(fruit);
                  setIsWallPaused(true);
                }}
                onMouseLeave={() => {
                  setHoveredFruit(null);
                  setIsWallPaused(false);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveFruit(fruit);
                  setIsWallPaused(true);
                  setTimeout(() => {
                    encyclopediaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Footer Info / Encyclopedia Detail */}
      <footer className="px-6 py-24 border-t border-nm-ink/5 bg-white/20">
        <div className="max-w-6xl mx-auto mb-20" ref={encyclopediaRef}>
          <div className="mb-12 flex items-center gap-3 md:gap-4">
            <div className="h-6 md:h-8 w-1.5 bg-nm-accent rounded-full shrink-0" />
            <h2 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-display font-extrabold tracking-tighter">水果百科详情</h2>
          </div>

          {activeFruit && (
            <motion.div
              key={activeFruit.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="relative"
            >
              <Card glass className="shadow-nm-hover p-8 md:p-12 overflow-hidden rounded-[48px]">
                <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
                  {/* Left: Image Section - Smaller and Contained */}
                  <div className="w-full lg:w-[320px] shrink-0">
                    <div className="relative">
                      <div className="aspect-[3/4] rounded-[32px] overflow-hidden shadow-nm-inset border-8 border-white/40">
                        <FruitImage 
                          name={activeFruit.name} 
                          fallbackImage={activeFruit.image} 
                          className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right: Content Section */}
                  <div className="flex-1 flex flex-col">
                    <div className="mb-10">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="px-3 py-1 rounded-full bg-nm-accent/10 text-nm-accent text-[10px] font-bold uppercase tracking-widest">
                          {activeFruit.family}
                        </span>
                        <div className="h-[1px] flex-1 bg-nm-ink/5" />
                      </div>
                      <h3 className="text-5xl md:text-6xl font-display font-extrabold tracking-tighter text-nm-ink mb-2 leading-none">
                        {activeFruit.name}
                      </h3>
                      <p className="text-nm-accent font-serif italic text-xl opacity-80">
                        {activeFruit.scientificName}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-bold text-nm-muted uppercase tracking-[0.2em] flex items-center gap-2">
                          <span className="w-4 h-[1px] bg-nm-accent/40" /> 历史来历
                        </h4>
                        <p className="text-base leading-relaxed text-nm-ink/80 font-serif italic">
                          {activeFruit.history}
                        </p>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-[10px] font-bold text-nm-muted uppercase tracking-[0.2em] flex items-center gap-2">
                          <span className="w-4 h-[1px] bg-nm-accent/40" /> 营养价值与功效
                        </h4>
                        <div className="bg-nm-bg/30 p-5 rounded-[24px] border border-white/40 shadow-nm-inset">
                          <p className="text-sm font-medium text-nm-ink/70 leading-relaxed">
                            {activeFruit.nutrition}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto pt-8 border-t border-nm-ink/5 grid grid-cols-3 gap-4">
                      <div className="flex flex-col">
                        <p className="text-[9px] font-bold text-nm-muted uppercase tracking-widest mb-1">原产地</p>
                        <p className="text-sm font-extrabold text-nm-ink">{activeFruit.origin}</p>
                      </div>
                      <div className="flex flex-col border-x border-nm-ink/5 px-4">
                        <p className="text-[9px] font-bold text-nm-muted uppercase tracking-widest mb-1">平均热量</p>
                        <p className="text-sm font-extrabold text-nm-ink">{activeFruit.kcal} <span className="text-[10px] font-normal opacity-60">kcal</span></p>
                      </div>
                      <div className="flex flex-col">
                        <p className="text-[9px] font-bold text-nm-muted uppercase tracking-widest mb-1">成熟季节</p>
                        <p className="text-sm font-extrabold text-nm-ink">{activeFruit.season}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </div>

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <Apple size={20} />
            <span className="font-display font-bold">FruitDex</span>
          </div>
          <p className="text-xs text-nm-muted">© 2024 FruitDex. 探索自然，科普生活。</p>
          <div className="flex gap-6">
            <a href="#" className="text-xs text-nm-muted hover:text-nm-accent transition-colors">隐私政策</a>
            <a href="#" className="text-xs text-nm-muted hover:text-nm-accent transition-colors">使用条款</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

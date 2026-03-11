import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, ListTodo, PlusCircle, Layers, Sparkles } from 'lucide-react';
import HomePage from './pages/HomePage';
import TaskPage from './pages/TaskPage';
import AddCardPage from './pages/AddCardPage';
import DeckPage from './pages/DeckPage';
import AIPage from './pages/AIPage';

function BottomNav() {
    const location = useLocation();
    const tabs = [
        { path: '/', icon: <Home size={22} />, label: '首頁' },
        { path: '/task', icon: <ListTodo size={22} />, label: '任務' },
        { path: '/add', icon: <PlusCircle size={22} />, label: '新增' },
        { path: '/deck', icon: <Layers size={22} />, label: '牌組' },
        { path: '/ai', icon: <Sparkles size={22} />, label: 'AI生成' },
    ];

    return (
        <nav className="bottom-nav">
            {tabs.map(tab => (
                <Link
                    key={tab.path}
                    to={tab.path}
                    className={`nav-item ${location.pathname === tab.path ? 'active' : ''}`}
                >
                    {tab.icon}
                    <span>{tab.label}</span>
                </Link>
            ))}
        </nav>
    );
}

function App() {
    useEffect(() => {
        // ── iOS PWA: fix blank space after keyboard dismissal ─────────────────
        // When the virtual keyboard hides, iOS doesn't always reset
        // window.scrollY to 0, leaving a white gap at the bottom.
        // We listen to visualViewport resize (fires on keyboard open/close)
        // and force scroll back to origin.
        const vv = window.visualViewport;

        const syncHeight = () => {
            // Update CSS var so .app-container can use it instead of 100dvh
            const h = vv ? vv.height : window.innerHeight;
            document.documentElement.style.setProperty('--app-height', `${h}px`);
            // Kick scroll back to (0,0) with a small delay to let the
            // browser finish its own resize animation first.
            requestAnimationFrame(() => window.scrollTo(0, 0));
        };

        syncHeight();
        if (vv) {
            vv.addEventListener('resize', syncHeight);
            vv.addEventListener('scroll', syncHeight);
        }
        window.addEventListener('resize', syncHeight);

        return () => {
            if (vv) {
                vv.removeEventListener('resize', syncHeight);
                vv.removeEventListener('scroll', syncHeight);
            }
            window.removeEventListener('resize', syncHeight);
        };
    }, []);

    return (
        <Router basename={import.meta.env.BASE_URL}>
            <div className="app-container">
                <main className="content">
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/task" element={<TaskPage />} />
                        <Route path="/add" element={<AddCardPage />} />
                        <Route path="/deck" element={<DeckPage />} />
                        <Route path="/ai" element={<AIPage />} />
                    </Routes>
                </main>
                <BottomNav />
            </div>
        </Router>
    );
}

export default App;

import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, ListTodo, PlusCircle, Layers } from 'lucide-react';
import HomePage from './pages/HomePage';
import TaskPage from './pages/TaskPage';
import AddCardPage from './pages/AddCardPage';
import DeckPage from './pages/DeckPage';

function BottomNav() {
    const location = useLocation();
    const tabs = [
        { path: '/', icon: <Home size={24} />, label: '首頁' },
        { path: '/task', icon: <ListTodo size={24} />, label: '任務' },
        { path: '/add', icon: <PlusCircle size={24} />, label: '新增' },
        { path: '/deck', icon: <Layers size={24} />, label: '牌組' },
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
    return (
        <Router>
            <div className="app-container">
                <main className="content">
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/task" element={<TaskPage />} />
                        <Route path="/add" element={<AddCardPage />} />
                        <Route path="/deck" element={<DeckPage />} />
                    </Routes>
                </main>
                <BottomNav />
            </div>
        </Router>
    );
}

export default App;

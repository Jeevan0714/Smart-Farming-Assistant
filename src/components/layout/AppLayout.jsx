import { useEffect } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import Navigation from './Navigation';
import { useAppContext } from '../../context/AppContext';

const AppLayout = () => {
  const { user, lang, setLang, t, handleLogout } = useAppContext();
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let pageTitle = 'Smart Farming Assistant - AI Agriculture Advisor';
    if (path === '/dashboard') pageTitle = 'Live Telemetry & Dashboard | Smart Farming Assistant';
    if (path === '/crops') pageTitle = 'Crop Growth Profiles & FAO-56 Advisor | Smart Farming Assistant';
    if (path === '/diagnosis') pageTitle = 'AI Plant Leaf Disease Diagnosis | Smart Farming Assistant';
    if (path === '/assistant') pageTitle = 'Voice AI Agricultural Assistant | Smart Farming Assistant';
    document.title = pageTitle;
  }, [location.pathname]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Determine background class based on route
  const getBgClass = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'bg-dashboard';
    if (path === '/crops') return 'bg-crops';
    if (path === '/diagnosis') return 'bg-diagnosis';
    if (path === '/assistant') return 'bg-assistant';
    return '';
  };

  return (
    <div className={`app-container ${getBgClass()}`}>
      <Navigation />
      
      <main className="app-main">
        <header className="page-header">
          <div className="top-nav">
            <div className="user-profile">
              <img className="user-avatar" src={user.photoURL} alt={user.displayName} />
              <div className="user-details">
                <span className="user-name">{t["welcome-user"]}{user.displayName.split(' ')[0]} 👋</span>
                <button className="btn-logout" onClick={handleLogout}>{t["btn-logout"]}</button>
              </div>
            </div>

            <div className="lang-btn-group">
              <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>English</button>
              <button className={`lang-btn ${lang === 'kn' ? 'active' : ''}`} onClick={() => setLang('kn')}>ಕನ್ನಡ</button>
            </div>
          </div>
        </header>

        <section className="page-content">
          <Outlet />
        </section>

        <footer>
          <p>{t["footer-text"]}</p>
        </footer>
      </main>
    </div>
  );
};

export default AppLayout;

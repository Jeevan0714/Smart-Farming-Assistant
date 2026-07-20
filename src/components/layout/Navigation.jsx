import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Sprout, Camera, Mic2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

const Navigation = () => {
  const { t } = useAppContext();

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: t['nav-dashboard'] },
    { to: '/crops', icon: Sprout, label: t['nav-crops'] },
    { to: '/diagnosis', icon: Camera, label: t['nav-diagnosis'] },
    { to: '/assistant', icon: Mic2, label: t['nav-assistant'] },
  ];

  return (
    <nav className="app-navigation">
      <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img src="/logo.png" alt="Smart Farming Assistant Logo" style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }} />
        <span className="brand-text" style={{ fontSize: '1.2rem', fontWeight: '800', letterSpacing: '0.5px' }}>SFA</span>
      </div>
      <div className="nav-links">
        {navItems.map((item) => (
          <NavLink 
            key={item.to} 
            to={item.to} 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={24} />
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default Navigation;

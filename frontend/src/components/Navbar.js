import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { cartAPI } from '../api';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    if (user) {
      cartAPI.get()
        .then(data => setCartCount(data.item_count || 0))
        .catch(() => {});
    } else {
      setCartCount(0);
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">UPV<span>Shop</span></Link>
      <div className="navbar-links">
        <Link to="/" className="nav-link">Tienda</Link>
        {user && <Link to="/orders" className="nav-link">Mis Órdenes</Link>}
        {user?.role === 'admin' && <Link to="/admin" className="nav-link" style={{color:'var(--accent)'}}>⚙ Admin</Link>}
        {user ? (
          <>
            <Link to="/cart" className="cart-btn">
              🛒 Carrito
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </Link>
            <button className="nav-link" onClick={handleLogout}>Salir</button>
          </>
        ) : (
          <>
            <Link to="/login" className="nav-link">Iniciar sesión</Link>
            <Link to="/register" className="btn-accent">Registrarse</Link>
          </>
        )}
      </div>
    </nav>
  );
}

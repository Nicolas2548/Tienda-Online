import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { catalogAPI, cartAPI } from '../api';
import { useAuth } from '../context/AuthContext';

function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, [onDone]);
  return <div className={`toast ${type}`}>{msg}</div>;
}

const EMOJI = { Electronics: '💻', Accessories: '🎒', default: '📦' };

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchProducts = useCallback(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (category) params.category = category;
    catalogAPI.products(params)
      .then(d => setProducts(d.products))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, category]);

  useEffect(() => {
    catalogAPI.categories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const id = setTimeout(fetchProducts, 300);
    return () => clearTimeout(id);
  }, [fetchProducts]);

  const handleAdd = async (product) => {
    if (!user) { navigate('/login'); return; }
    setAdding(product.id);
    try {
      await cartAPI.add(product.id, 1);
      setToast({ msg: `"${product.name}" agregado al carrito`, type: 'success' });
    } catch (e) {
      setToast({ msg: e.message, type: 'error' });
    } finally {
      setTimeout(() => setAdding(null), 800);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Catálogo</h1>
      <p className="page-subtitle">
        {products.length} producto{products.length !== 1 ? 's' : ''} disponible{products.length !== 1 ? 's' : ''}
      </p>

      <div className="filters">
        <input
          className="filter-input"
          placeholder="Buscar productos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          className={`filter-btn ${category === '' ? 'active' : ''}`}
          onClick={() => setCategory('')}
        >Todos</button>
        {categories.map(c => (
          <button
            key={c}
            className={`filter-btn ${category === c ? 'active' : ''}`}
            onClick={() => setCategory(c === category ? '' : c)}
          >{c}</button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><p>Cargando productos...</p></div>
      ) : products.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🔍</div>
          <h3>Sin resultados</h3>
          <p>Intenta con otro término de búsqueda</p>
        </div>
      ) : (
        <div className="products-grid">
          {products.map(p => (
            <div key={p.id} className="product-card">
              <div className="product-img">
                {p.image_url
                  ? <img src={p.image_url} alt={p.name} onError={e => { e.target.style.display='none'; }} />
                  : <span>{EMOJI[p.category] || EMOJI.default}</span>
                }
              </div>
              <div className="product-body">
                <div className="product-category">{p.category || 'General'}</div>
                <div className="product-name">{p.name}</div>
                <div className="product-desc">{p.description || 'Sin descripción'}</div>
                <div className="product-footer">
                  <span className="product-price">${parseFloat(p.price).toFixed(2)}</span>
                  <span className="stock-badge">{p.stock} en stock</span>
                </div>
                <button
                  className={`add-btn ${adding === p.id ? 'adding' : ''}`}
                  onClick={() => handleAdd(p)}
                  disabled={p.stock === 0 || adding === p.id}
                >
                  {adding === p.id ? '✓ Agregado' : p.stock === 0 ? 'Sin stock' : '+ Agregar al carrito'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <Toast
          msg={toast.msg}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
}

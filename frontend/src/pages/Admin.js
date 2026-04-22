import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { catalogAPI, ordersAPI } from '../api';
import { useAuth } from '../context/AuthContext';

const STATUS_LABELS = {
  pending:    { label: 'Pendiente',  cls: 'status-pending' },
  processing: { label: 'En proceso', cls: 'status-processing' },
  shipped:    { label: 'Enviado',    cls: 'status-shipped' },
  delivered:  { label: 'Entregado', cls: 'status-delivered' },
  cancelled:  { label: 'Cancelado', cls: 'status-cancelled' },
};

function ProductForm({ product, onSave, onCancel }) {
  const [form, setForm] = useState(product || {
    name: '', description: '', price: '', stock: '', category: '', image_url: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = { ...form, price: parseFloat(form.price), stock: parseInt(form.stock) };
      if (product) {
        await fetch(`http://localhost:8002/products/${product.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(data)
        }).then(r => { if (!r.ok) throw new Error('Error al actualizar'); return r.json(); });
      } else {
        await fetch('http://localhost:8002/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(data)
        }).then(r => { if (!r.ok) throw new Error('Error al crear'); return r.json(); });
      }
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <h2 className="modal-title">{product ? 'Editar producto' : 'Nuevo producto'}</h2>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Nombre</label>
              <input className="form-input" value={form.name} onChange={set('name')} required />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Descripción</label>
              <input className="form-input" value={form.description} onChange={set('description')} />
            </div>
            <div className="form-group">
              <label className="form-label">Precio ($)</label>
              <input className="form-input" type="number" step="0.01" min="0" value={form.price} onChange={set('price')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Stock</label>
              <input className="form-input" type="number" min="0" value={form.stock} onChange={set('stock')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <input className="form-input" value={form.category} onChange={set('category')} />
            </div>
            <div className="form-group">
              <label className="form-label">URL de imagen</label>
              <input className="form-input" value={form.image_url} onChange={set('image_url')} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-outline" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="checkout-btn" style={{ flex: 1 }} disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'new' | product object
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (user.role !== 'admin') { navigate('/'); return; }
  }, [user, navigate]);

  useEffect(() => {
    if (tab === 'products') fetchProducts();
    if (tab === 'orders') fetchOrders();
  }, [tab]);

  const fetchProducts = () => {
    setLoading(true);
    catalogAPI.products({ limit: 100 })
      .then(d => setProducts(d.products))
      .finally(() => setLoading(false));
  };

  const fetchOrders = () => {
    setLoading(true);
    fetch('http://localhost:8004/orders/admin/all', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).then(r => r.json()).then(setOrders).finally(() => setLoading(false));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este producto?')) return;
    await fetch(`http://localhost:8002/products/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    fetchProducts();
  };

  const handleStatusChange = async (orderId, status) => {
    await fetch(`http://localhost:8004/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ status })
    });
    fetchOrders();
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(search.toLowerCase())
  );

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="page">
      <h1 className="page-title">Panel de administración</h1>
      <p className="page-subtitle">Gestiona productos y órdenes de UpvShop</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        {['products', 'orders'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t ? 'var(--text)' : 'var(--text2)',
              padding: '0.7rem 1.2rem', cursor: 'pointer',
              fontFamily: 'DM Sans', fontSize: '0.95rem', fontWeight: 500,
              marginBottom: '-1px', transition: 'color 0.15s'
            }}
          >
            {t === 'products' ? '📦 Productos' : '🧾 Órdenes'}
          </button>
        ))}
      </div>

      {/* PRODUCTS TAB */}
      {tab === 'products' && (
        <>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
            <input
              className="filter-input"
              placeholder="Buscar productos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className="btn-accent" onClick={() => setModal('new')} style={{ whiteSpace: 'nowrap' }}>
              + Nuevo producto
            </button>
          </div>

          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['ID', 'Nombre', 'Categoría', 'Precio', 'Stock', 'Acciones'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '0.75rem 1rem', color: 'var(--text2)', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text2)' }}>#{p.id}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{p.name}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.category || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'Syne', fontWeight: 700 }}>${parseFloat(p.price).toFixed(2)}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          color: p.stock === 0 ? 'var(--danger)' : p.stock < 10 ? '#e8a020' : 'var(--success)',
                          fontWeight: 600
                        }}>{p.stock}</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => setModal(p)}
                            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.8rem' }}
                          >Editar</button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            style={{ background: 'rgba(224,85,85,0.1)', border: '1px solid rgba(224,85,85,0.3)', borderRadius: 6, color: 'var(--danger)', padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.8rem' }}
                          >Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredProducts.length === 0 && (
                <div className="empty"><p>Sin resultados</p></div>
              )}
            </div>
          )}
        </>
      )}

      {/* ORDERS TAB */}
      {tab === 'orders' && (
        <>
          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : orders.length === 0 ? (
            <div className="empty"><div className="empty-icon">🧾</div><h3>Sin órdenes</h3></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Orden', 'Usuario ID', 'Total', 'Estado', 'Fecha', 'Cambiar estado'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '0.75rem 1rem', color: 'var(--text2)', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const s = STATUS_LABELS[o.status] || { label: o.status, cls: '' };
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'Syne', fontWeight: 700 }}>#{o.id}</td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text2)' }}>User #{o.user_id}</td>
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'Syne', fontWeight: 700, color: 'var(--accent)' }}>${parseFloat(o.total).toFixed(2)}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span className={`status-badge ${s.cls}`}>{s.label}</span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text2)', fontSize: '0.8rem' }}>
                          {new Date(o.created_at).toLocaleDateString('es-MX')}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <select
                            value={o.status}
                            onChange={e => handleStatusChange(o.id, e.target.value)}
                            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '0.3rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'DM Sans' }}
                          >
                            {Object.entries(STATUS_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {modal && (
        <ProductForm
          product={modal === 'new' ? null : modal}
          onSave={() => { setModal(null); fetchProducts(); }}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}

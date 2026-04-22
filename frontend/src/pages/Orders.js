import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ordersAPI } from '../api';
import { useAuth } from '../context/AuthContext';

const STATUS_LABELS = {
  pending:    { label: 'Pendiente',    cls: 'status-pending' },
  processing: { label: 'En proceso',   cls: 'status-processing' },
  shipped:    { label: 'Enviado',      cls: 'status-shipped' },
  delivered:  { label: 'Entregado',    cls: 'status-delivered' },
  cancelled:  { label: 'Cancelado',    cls: 'status-cancelled' },
};

function formatDate(str) {
  return new Date(str).toLocaleDateString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export default function Orders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [details, setDetails] = useState({});

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    ordersAPI.list()
      .then(setOrders)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, navigate]);

  const toggleOrder = async (orderId) => {
    if (expanded === orderId) { setExpanded(null); return; }
    setExpanded(orderId);
    if (!details[orderId]) {
      try {
        const data = await ordersAPI.get(orderId);
        setDetails(d => ({ ...d, [orderId]: data }));
      } catch (e) { console.error(e); }
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /><p>Cargando órdenes...</p></div>;

  return (
    <div className="page">
      <h1 className="page-title">Mis órdenes</h1>
      <p className="page-subtitle">{orders.length} orden{orders.length !== 1 ? 'es' : ''} en total</p>

      {orders.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📦</div>
          <h3>Sin órdenes aún</h3>
          <p>Cuando realices una compra aparecerá aquí</p>
          <Link to="/" className="btn-accent" style={{display:'inline-block',marginTop:'1.5rem',textDecoration:'none'}}>
            Ir a la tienda
          </Link>
        </div>
      ) : (
        orders.map(order => {
          const s = STATUS_LABELS[order.status] || { label: order.status, cls: '' };
          const detail = details[order.id];
          return (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <div>
                  <div className="order-id">Orden #{order.id}</div>
                  <div className="order-date">{formatDate(order.created_at)}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'1rem'}}>
                  <span className={`status-badge ${s.cls}`}>{s.label}</span>
                  <span className="order-total">${parseFloat(order.total).toFixed(2)}</span>
                  <button
                    onClick={() => toggleOrder(order.id)}
                    style={{background:'none',border:'1px solid var(--border)',borderRadius:6,color:'var(--text2)',padding:'0.3rem 0.7rem',cursor:'pointer',fontSize:'0.8rem',transition:'border-color 0.15s'}}
                  >
                    {expanded === order.id ? 'Ocultar ▲' : 'Detalles ▼'}
                  </button>
                </div>
              </div>

              {expanded === order.id && (
                <div style={{borderTop:'1px solid var(--border)',paddingTop:'1rem',marginTop:'0.5rem'}}>
                  {!detail ? (
                    <div style={{color:'var(--text2)',fontSize:'0.85rem'}}>Cargando detalles...</div>
                  ) : (
                    <div>
                      {detail.items?.map(item => (
                        <div key={item.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.5rem 0',borderBottom:'1px solid var(--border)',fontSize:'0.9rem'}}>
                          <div>
                            <div style={{fontWeight:500}}>{item.product_name}</div>
                            <div style={{color:'var(--text2)',fontSize:'0.8rem'}}>
                              {item.quantity} × ${parseFloat(item.unit_price).toFixed(2)}
                            </div>
                          </div>
                          <div style={{fontFamily:'Syne',fontWeight:700,color:'var(--accent)'}}>
                            ${(item.quantity * parseFloat(item.unit_price)).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

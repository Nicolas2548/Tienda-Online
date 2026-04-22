import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cartAPI, ordersAPI, paymentsAPI } from '../api';
import { useAuth } from '../context/AuthContext';

function PaymentModal({ order, onClose, onSuccess }) {
  const [method, setMethod] = useState('card');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handlePay = async () => {
    setLoading(true);
    try {
      const data = await paymentsAPI.process(order.order_id, method);
      setResult(data);
      if (data.success) onSuccess();
    } catch (e) {
      setResult({ success: false, message: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {result ? (
          <div className="payment-result">
            <div className="payment-icon">{result.success ? '✅' : '❌'}</div>
            <div className="payment-msg">{result.success ? '¡Pago exitoso!' : 'Pago rechazado'}</div>
            <div className="payment-sub">{result.message}</div>
            {result.transaction_id && (
              <p style={{marginTop:'0.5rem', fontSize:'0.78rem', color:'var(--text2)'}}>
                Transacción: {result.transaction_id}
              </p>
            )}
            <div className="modal-actions">
              <button className="checkout-btn" onClick={onClose}>
                {result.success ? 'Ver mis órdenes' : 'Cerrar'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="modal-title">Confirmar pago</h2>
            <p style={{color:'var(--text2)',fontSize:'0.9rem',marginBottom:'1.2rem'}}>
              Total a pagar: <strong style={{color:'var(--accent)'}}>
                ${parseFloat(order.total).toFixed(2)}
              </strong>
            </p>
            <div className="form-group">
              <label className="form-label">Método de pago</label>
              <select
                className="form-input"
                value={method}
                onChange={e => setMethod(e.target.value)}
              >
                <option value="card">💳 Tarjeta de crédito/débito</option>
                <option value="paypal">🅿️ PayPal</option>
                <option value="transfer">🏦 Transferencia bancaria</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-outline" onClick={onClose} disabled={loading}>Cancelar</button>
              <button className="checkout-btn" style={{flex:1}} onClick={handlePay} disabled={loading}>
                {loading ? 'Procesando...' : 'Pagar ahora'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const EMOJI = { Electronics: '💻', Accessories: '🎒', default: '📦' };

export default function Cart() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [modal, setModal] = useState(null);

  const fetchCart = useCallback(() => {
    if (!user) { navigate('/login'); return; }
    cartAPI.get()
      .then(setCart)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, navigate]);

  useEffect(() => { fetchCart(); }, [fetchCart]);

  const handleQty = async (item, delta) => {
    const newQty = item.quantity + delta;
    if (newQty < 1) return handleRemove(item.id);
    try {
      await cartAPI.update(item.id, newQty);
      fetchCart();
    } catch (e) { console.error(e); }
  };

  const handleRemove = async (itemId) => {
    try {
      await cartAPI.remove(itemId);
      fetchCart();
    } catch (e) { console.error(e); }
  };

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const items = cart.items.map(i => ({ product_id: i.product_id, quantity: i.quantity }));
      const order = await ordersAPI.create(items);
      await cartAPI.clear();
      setModal(order);
    } catch (e) {
      alert(e.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    fetchCart();
  };

  const handleModalClose = () => {
    setModal(null);
    navigate('/orders');
  };

  if (loading) return <div className="loading"><div className="spinner" /><p>Cargando carrito...</p></div>;

  return (
    <div className="page">
      <h1 className="page-title">Tu carrito</h1>

      {!cart || cart.items.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🛒</div>
          <h3>Tu carrito está vacío</h3>
          <p>Agrega productos para continuar</p>
          <Link to="/" className="btn-accent" style={{display:'inline-block',marginTop:'1.5rem',textDecoration:'none'}}>
            Ver productos
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-items">
            {cart.items.map(item => (
              <div key={item.id} className="cart-item">
                <div className="cart-item-img">
                  {EMOJI[item.category] || EMOJI.default}
                </div>
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.name}</div>
                  <div className="cart-item-price">
                    ${parseFloat(item.price).toFixed(2)} c/u
                  </div>
                </div>
                <div className="qty-controls">
                  <button className="qty-btn" onClick={() => handleQty(item, -1)}>−</button>
                  <span className="qty-num">{item.quantity}</span>
                  <button className="qty-btn" onClick={() => handleQty(item, 1)}
                    disabled={item.quantity >= item.stock}>+</button>
                </div>
                <div style={{minWidth:80,textAlign:'right',fontFamily:'Syne',fontWeight:700,color:'var(--accent)'}}>
                  ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                </div>
                <button className="remove-btn" onClick={() => handleRemove(item.id)}>✕</button>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <h2 className="summary-title">Resumen</h2>
            <div className="summary-row">
              <span>Productos ({cart.item_count})</span>
              <span>${parseFloat(cart.total).toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Envío</span>
              <span style={{color:'var(--success)'}}>Gratis</span>
            </div>
            <div className="summary-total">
              <span>Total</span>
              <span>${parseFloat(cart.total).toFixed(2)}</span>
            </div>
            <button
              className="checkout-btn"
              onClick={handleCheckout}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? 'Creando orden...' : 'Proceder al pago →'}
            </button>
          </div>
        </div>
      )}

      {modal && (
        <PaymentModal
          order={modal}
          onClose={handleModalClose}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

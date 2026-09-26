import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';
import Notification from './Notification';
import MenuItemForm from './MenuItemForm';
import { useTheme } from '../contexts/ThemeContext';
import {
  Plus, Edit2, Trash2, Search, Package, Eye, EyeOff, X, Soup, Flame,
  Utensils, Pizza, Coffee, Cookie, IceCream, Sparkles, LayoutGrid,
  List, SlidersHorizontal,
} from 'lucide-react';
import useCurrency from '../hooks/useCurrency';

const CATEGORY_ICONS = {
  All: Sparkles, Starters: Soup, Biryani: Flame, 'Main Course': Utensils,
  Chinese: Pizza, Breads: Cookie, Desserts: IceCream, Beverages: Coffee,
};

const CAT_COLORS = {
  Starters:    { g1: '#10b981', g2: '#14b8a6' },
  Biryani:     { g1: '#f59e0b', g2: '#f97316' },
  'Main Course': { g1: '#8b5cf6', g2: '#a78bfa' },
  Chinese:     { g1: '#f43f5e', g2: '#fb7185' },
  Breads:      { g1: '#eab308', g2: '#facc15' },
  Desserts:    { g1: '#ec4899', g2: '#f472b6' },
  Beverages:   { g1: '#0ea5e9', g2: '#38bdf8' },
};
const DEFAULT_CAT = { g1: '#f97316', g2: '#fb923c' };
const getCat = (c) => CAT_COLORS[c] || DEFAULT_CAT;

const MenuManagement = ({ locationSettings }) => {
  const { format: fmt } = useCurrency(locationSettings);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const css = getCss(isDark);
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [notif, setNotif] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [view, setView] = useState('grid');
  const [sort, setSort] = useState('name');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/login');
  }, [navigate]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/menu');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems((Array.isArray(data) ? data : []).map(i => ({
        ...i,
        isAvailable: i.isAvailable !== undefined ? i.isAvailable : true,
      })));
    } catch (err) {
      setItems([]);
      notify(err.message || 'Failed to load menu', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const notify = (message, type = 'success') => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 3000);
  };

  const handleAdd = async (item) => {
    try {
      const res = await authFetch('/api/menu', { method: 'POST', body: JSON.stringify(item) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const newItem = await res.json();
      setItems(prev => [newItem, ...prev]);
      notify('Item added successfully');
    } catch (err) { notify(err.message || 'Error adding item', 'error'); }
    setShowForm(false); setEditing(null);
  };

  const handleUpdate = async (item) => {
    try {
      if (!item.id) throw new Error('Item ID missing');
      const res = await authFetch(`/api/menu/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: item.name, price: parseFloat(item.price), category: item.category,
          description: item.description || null, image: item.image || null,
          isAvailable: item.isAvailable !== undefined ? item.isAvailable : true,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { item: updated } = await res.json();
      setItems(prev => prev.map(m => m.id === item.id ? updated : m));
      notify('Item updated successfully');
    } catch (err) { notify(err.message || 'Error updating item', 'error'); }
    setShowForm(false); setEditing(null);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const res = await authFetch(`/api/menu/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems(prev => prev.filter(i => i.id !== id));
      notify(`"${name}" deleted`);
    } catch (err) { notify(err.message || 'Error deleting', 'error'); }
  };

  const toggleAvail = async (id, isAvailable) => {
    try {
      const res = await authFetch(`/api/menu/${id}/availability`, {
        method: 'PUT', body: JSON.stringify({ isAvailable }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems(prev => prev.map(i => i.id === id ? { ...i, isAvailable } : i));
      notify(isAvailable ? 'Marked as available' : 'Marked as unavailable');
    } catch (err) { notify(err.message || 'Error updating', 'error'); }
  };

  const categories = useMemo(() => ['All', ...new Set(items.map(i => i.category).filter(Boolean))], [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        i.name?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q)
      );
    }
    if (catFilter !== 'All') list = list.filter(i => i.category === catFilter);
    if (sort === 'name') list.sort((a, b) => a.name?.localeCompare(b.name));
    if (sort === 'price-asc') list.sort((a, b) => (a.price || 0) - (b.price || 0));
    if (sort === 'price-desc') list.sort((a, b) => (b.price || 0) - (a.price || 0));
    return list;
  }, [items, search, catFilter, sort]);

  const scroll = (d) => scrollRef.current?.scrollBy({ left: d * 200, behavior: 'smooth' });

  return (
    <div style={css.page}>
      {notif && <Notification message={notif.message} type={notif.type} onClose={() => setNotif(null)} />}

      <style>{`
        ${animations}
        /* Responsive Grid */
        .menu-grid { display: grid; grid-template-columns: repeat(1, 1fr); gap: 16px; }
        @media (min-width: 480px) { .menu-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 768px) { .menu-grid { grid-template-columns: repeat(2, 1fr); gap: 18px; } }
        @media (min-width: 1024px) { .menu-grid { grid-template-columns: repeat(3, 1fr); gap: 20px; } }
        @media (min-width: 1280px) { .menu-grid { grid-template-columns: repeat(4, 1fr); } }
        
        /* Responsive Container */
        .menu-container { padding: 16px 12px; }
        @media (min-width: 640px) { .menu-container { padding: 20px 16px; } }
        @media (min-width: 1024px) { .menu-container { padding: 28px 24px; } }
        
        /* Header Responsive */
        .menu-header { flex-direction: column; align-items: stretch; gap: 12px; }
        @media (min-width: 640px) { .menu-header { flex-direction: row; align-items: center; justify-content: space-between; } }
        
        .menu-header-right { justify-content: flex-start; flex-wrap: wrap; }
        @media (min-width: 640px) { .menu-header-right { justify-content: flex-end; } }
        
        /* Category Pills - Attractive */
        .cat-pill-active { animation: catBounce 0.4s cubic-bezier(0.4,0,0.2,1); }
        .cat-pill-hover:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
        .cat-pill-hover:active { transform: scale(0.97); }
        
        /* Card Hover Effects */
        .card-hover:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.1); }
        .card-hover:hover .card-img { transform: scale(1.05); }
        
        /* Row Hover */
        .row-hover:hover { transform: translateX(4px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
        
        /* Button Hover */
        .btn-hover:hover { transform: scale(1.05); }
        .btn-hover:active { transform: scale(0.95); }
        
        /* Touch-friendly */
        @media (hover: none) {
          .card-hover:hover { transform: none; box-shadow: 0 2px 16px rgba(0,0,0,0.05); }
          .row-hover:hover { transform: none; }
        }
      `}</style>

      {/* Background */}
      <div style={css.bg}>
        <div style={css.orb1} /><div style={css.orb2} /><div style={css.orb3} />
        <div style={css.grid} />
      </div>

      <div className="menu-container" style={css.container}>
        {/* Header */}
        <header className="menu-header" style={css.header}>
          <div style={css.headerLeft}>
            <div style={css.logoWrap}>
              <div style={css.logo}><Utensils className="w-6 h-6" color="#fff" /></div>
              <div style={css.logoRing} />
            </div>
            <div>
              <h1 style={css.title}>Menu Management</h1>
              <p style={css.subtitle}>
                <span style={css.dotGreen} /> {items.length} items total &middot; {items.filter(i => i.isAvailable).length} available
              </p>
            </div>
          </div>

          <div className="menu-header-right" style={css.headerRight}>
            <div style={css.viewToggle}>
              <button onClick={() => setView('grid')} style={{ ...css.viewBtn, ...(view === 'grid' ? css.viewBtnOn : {}) }} title="Grid view">
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setView('list')} style={{ ...css.viewBtn, ...(view === 'list' ? css.viewBtnOn : {}) }} title="List view">
                <List className="w-4 h-4" />
              </button>
            </div>

            <div style={css.sortWrap}>
              <SlidersHorizontal className="w-3.5 h-3.5" color="#94a3b8" />
              <select value={sort} onChange={e => setSort(e.target.value)} style={css.sortSelect}>
                <option value="name">Name A-Z</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>

            <button onClick={() => { setShowForm(true); setEditing(null); }} className="btn-hover" style={css.addBtn}>
              <Plus className="w-4 h-4" /> Add New Item
            </button>
          </div>
        </header>

        {/* Search */}
        <div style={css.searchBox}>
          <Search className="w-4 h-4" color="#94a3b8" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, description, or category..."
            style={css.searchInput}
          />
          {search && (
            <button onClick={() => setSearch('')} style={css.clearBtn} title="Clear search">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Categories */}
        <div style={css.catSection}>
          <button onClick={() => scroll(-1)} style={{ ...css.catArrow, left: 0 }}>‹</button>
          <div ref={scrollRef} style={css.catScroll}>
            {categories.map(c => {
              const active = catFilter === c;
              const Icon = CATEGORY_ICONS[c] || Utensils;
              const col = getCat(c === 'All' ? '' : c);
              return (
                <button
                  key={c}
                  onClick={() => setCatFilter(c)}
                  className={`cat-pill-hover ${active ? 'cat-pill-active' : ''}`}
                  style={{
                    ...css.catPill,
                    ...(active ? {
                      background: `linear-gradient(135deg, ${col.g1}, ${col.g2})`,
                      color: '#fff',
                      border: '2px solid transparent',
                      boxShadow: `0 6px 24px ${col.g1}44`,
                      transform: 'scale(1.06)',
                    } : {}),
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {c === 'All' ? 'All Items' : c}
                  {active && <span style={css.catBadge}>{filtered.length}</span>}
                </button>
              );
            })}
          </div>
          <button onClick={() => scroll(1)} style={{ ...css.catArrow, right: 0 }}>›</button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="menu-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ ...css.skelCard, animationDelay: `${i * 80}ms` }}>
                <div style={css.skelImg} />
                <div style={css.skelBody}>
                  <div style={{ ...css.skelLine, width: '60%' }} />
                  <div style={{ ...css.skelLine, width: '40%', height: 10 }} />
                  <div style={{ ...css.skelLine, width: '80%', height: 10 }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={css.empty}>
            <div style={css.emptyIcon}>🍽️</div>
            <h3 style={css.emptyTitle}>No items found</h3>
            <p style={css.emptyDesc}>
              {search ? `No results for "${search}"` : 'No items in this category yet'}
            </p>
            <button onClick={() => { setSearch(''); setCatFilter('All'); }} style={css.emptyBtn}>
              Clear Filters
            </button>
          </div>
        ) : view === 'grid' ? (
          <div className="menu-grid">
            {filtered.map((item, i) => (
              <Card key={item.id} item={item} fmt={fmt} i={i} css={css}
                onEdit={() => { setEditing(item); setShowForm(true); }}
                onDelete={() => handleDelete(item.id, item.name)}
                onToggle={() => toggleAvail(item.id, !item.isAvailable)} />
            ))}
          </div>
        ) : (
          <div style={css.list}>
            {filtered.map((item, i) => (
              <Row key={item.id} item={item} fmt={fmt} i={i} css={css}
                onEdit={() => { setEditing(item); setShowForm(true); }}
                onDelete={() => handleDelete(item.id, item.name)}
                onToggle={() => toggleAvail(item.id, !item.isAvailable)} />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div style={css.overlay} onClick={() => { setShowForm(false); setEditing(null); }}>
          <div style={css.modal} onClick={e => e.stopPropagation()}>
            <div style={css.modalHead}>
              <div style={css.modalHeadLeft}>
                <div style={css.modalIcon}>
                  {editing ? <Edit2 className="w-4 h-4" color="#fff" /> : <Plus className="w-4 h-4" color="#fff" />}
                </div>
                <div>
                  <h3 style={css.modalTitle}>{editing ? 'Edit Menu Item' : 'Add New Item'}</h3>
                  <p style={css.modalSub}>{editing ? 'Update the details below' : 'Fill in the details to add a new dish'}</p>
                </div>
              </div>
              <button onClick={() => { setShowForm(false); setEditing(null); }} style={css.modalClose}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div style={css.modalBody}>
              <MenuItemForm onSave={editing ? handleUpdate : handleAdd}
                onCancel={() => { setShowForm(false); setEditing(null); }}
                initialData={editing || {}} locationSettings={locationSettings} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Card ─── */
const Card = ({ item, fmt, i, onEdit, onDelete, onToggle, css }) => {
  const [hovered, setHovered] = useState(false);
  const ok = item.isAvailable;
  const cat = getCat(item.category);
  return (
    <div
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className="card-hover"
      style={{
        ...css.card,
        animation: `fadeUp 0.45s ease ${i * 50}ms both`,
      }}
    >
      {/* Image */}
      <div style={css.cardImgWrap}>
        {item.image ? (
          <img src={item.image} alt={item.name} className="card-img" style={css.cardImg} onError={e => { e.currentTarget.style.display = 'none'; }} />
        ) : (
          <div style={{ ...css.cardImgPH, background: `linear-gradient(135deg, ${cat.g1}22, ${cat.g2}11)` }}>
            <span style={{ fontSize: 48, opacity: 0.3 }}>{CATEGORY_ICONS[item.category] ? '' : '🍽️'}</span>
          </div>
        )}
        {/* Availability Badge */}
        <div style={{
          ...css.badge,
          background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)',
          color: ok ? '#059669' : '#e11d48',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: ok ? '#22c55e' : '#f43f5e',
            boxShadow: `0 0 6px ${ok ? '#22c55e' : '#f43f5e'}`,
          }} />
          {ok ? 'Available' : 'Sold Out'}
        </div>
        {/* Category Tag */}
        <div style={{
          ...css.catTag,
          background: `linear-gradient(135deg, ${cat.g1}, ${cat.g2})`,
        }}>
          {item.category || 'Other'}
        </div>
      </div>

      {/* Body */}
      <div style={css.cardBody}>
        <h3 style={css.cardName}>{item.name}</h3>
        {item.description && <p style={css.cardDesc}>{item.description}</p>}
        <div style={css.cardFoot}>
          <span style={css.cardPrice}>{fmt(item.price)}</span>
          <div style={css.cardActions}>
            <button onClick={onToggle} title={ok ? 'Mark as unavailable' : 'Mark as available'}
              style={{ ...css.actionBtn, background: ok ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)', color: ok ? '#059669' : '#e11d48' }}>
              {ok ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button onClick={onEdit} title="Edit this item" style={{ ...css.actionBtn, ...css.editAction }}>
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} title="Delete this item" style={{ ...css.actionBtn, ...css.deleteAction }}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Row ─── */
const Row = ({ item, fmt, i, onEdit, onDelete, onToggle, css }) => {
  const [hovered, setHovered] = useState(false);
  const ok = item.isAvailable;
  const cat = getCat(item.category);
  return (
    <div
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className="row-hover"
      style={{
        ...css.row,
        animation: `fadeUp 0.35s ease ${i * 40}ms both`,
      }}
    >
      {/* Image */}
      <div style={css.rowImgWrap}>
        {item.image ? (
          <img src={item.image} alt={item.name} style={css.rowImg} />
        ) : (
          <div style={{ ...css.rowImgPH, background: `linear-gradient(135deg, ${cat.g1}, ${cat.g2})` }}>
            <Package className="w-5 h-5" color="#fff" style={{ opacity: 0.5 }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div style={css.rowInfo}>
        <div style={css.rowInfoTop}>
          <h3 style={css.rowName}>{item.name}</h3>
          <span style={{ ...css.rowCat, background: `linear-gradient(135deg, ${cat.g1}, ${cat.g2})` }}>
            {item.category || 'Other'}
          </span>
          {!ok && <span style={css.rowUnavail}>Unavailable</span>}
        </div>
        {item.description && <p style={css.rowDesc}>{item.description}</p>}
      </div>

      {/* Price */}
      <span style={css.rowPrice}>{fmt(item.price)}</span>

      {/* Actions */}
      <div style={css.rowActions}>
        <button onClick={onToggle} title={ok ? 'Mark unavailable' : 'Mark available'}
          style={{ ...css.actionBtn, background: ok ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)', color: ok ? '#059669' : '#e11d48' }}>
          {ok ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        <button onClick={onEdit} title="Edit" style={{ ...css.actionBtn, ...css.editAction }}>
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} title="Delete" style={{ ...css.actionBtn, ...css.deleteAction }}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

/* ─── Animations ─── */
const animations = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes orbA { 0%,100%{transform:translate(0,0)} 50%{transform:translate(40px,-30px)} }
  @keyframes orbB { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-35px,25px)} }
  @keyframes orbC { 0%,100%{transform:translate(0,0) rotate(0deg)} 50%{transform:translate(25px,15px) rotate(180deg)} }
  @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.1)} }
  @keyframes slideModal { from{opacity:0;transform:translateY(30px) scale(0.97)} to{opacity:1;transform:none} }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes catBounce { 0%{transform:scale(1)} 50%{transform:scale(1.12)} 100%{transform:scale(1.06)} }
  @keyframes glowPulse { 0%,100%{box-shadow:0 4px 20px rgba(249,115,22,0.3)} 50%{box-shadow:0 8px 32px rgba(249,115,22,0.5)} }
  @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
  @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
  
  /* Responsive utilities */
  @media (max-width: 640px) {
    .hide-mobile { display: none !important; }
    .stack-mobile { flex-direction: column !important; align-items: stretch !important; }
  }
  @media (min-width: 641px) and (max-width: 1024px) {
    .hide-tablet { display: none !important; }
  }
`;

/* ─── Styles ─── */
const getCss = (isDark) => ({
  page: { minHeight: '100vh', position: 'relative', fontFamily: "'Inter',sans-serif", overflow: 'hidden', background: isDark ? '#0B1220' : 'transparent' },

  /* BG */
  bg: { position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' },
  orb1: { position: 'absolute', top: '-12%', right: '-8%', width: '45vw', height: '45vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.06), transparent 70%)', animation: 'orbA 20s ease-in-out infinite' },
  orb2: { position: 'absolute', bottom: '-8%', left: '-5%', width: '40vw', height: '40vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.05), transparent 70%)', animation: 'orbB 18s ease-in-out infinite' },
  orb3: { position: 'absolute', top: '45%', left: '35%', width: '30vw', height: '30vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.04), transparent 70%)', animation: 'orbC 25s linear infinite' },
  grid: { position: 'absolute', inset: 0, opacity: 0.015, backgroundImage: 'linear-gradient(rgba(0,0,0,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.08) 1px,transparent 1px)', backgroundSize: '50px 50px' },

  container: { position: 'relative', zIndex: 1, maxWidth: 1400, margin: '0 auto', padding: '20px 16px' },
  '@media (min-width:640px)': { container: { padding: '24px 20px' } },
  '@media (min-width:1024px)': { container: { padding: '28px 24px' } },

  /* Header */
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  logoWrap: { position: 'relative' },
  logo: { width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #f97316, #e11d48)', boxShadow: '0 8px 28px rgba(249,115,22,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoRing: { position: 'absolute', inset: -4, borderRadius: 20, border: '2px solid rgba(249,115,22,0.15)', animation: 'pulse 3s ease-in-out infinite' },
  title: { margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px', color: isDark ? '#f1f5f9' : '#0f172a' },
  subtitle: { margin: '2px 0 0', fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 },
  dotGreen: { width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.5)', display: 'inline-block' },

  headerRight: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },

  /* View Toggle */
  viewToggle: { display: 'flex', background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.6)', borderRadius: 10, padding: 3, border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)' },
  viewBtn: { padding: '7px 10px', borderRadius: 8, border: 'none', background: 'transparent', color: isDark ? '#64748b' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s ease' },
  viewBtnOn: { background: 'linear-gradient(135deg, #f97316, #e11d48)', color: '#fff', boxShadow: '0 4px 12px rgba(249,115,22,0.3)' },

  /* Sort */
  sortWrap: { display: 'flex', alignItems: 'center', gap: 4, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.6)', borderRadius: 10, padding: '0 10px', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)' },
  sortSelect: { border: 'none', background: 'transparent', fontSize: 12, fontWeight: 600, color: isDark ? '#cbd5e1' : '#475569', cursor: 'pointer', outline: 'none', padding: '8px 0' },

  /* Add Button */
  addBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #f97316, #e11d48)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 24px rgba(249,115,22,0.35)', transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)' },

  /* Search */
  searchBox: { display: 'flex', alignItems: 'center', gap: 10, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.65)', backdropFilter: 'blur(12px)', border: isDark ? '1.5px solid rgba(255,255,255,0.10)' : '1.5px solid rgba(0,0,0,0.05)', borderRadius: 14, padding: '10px 14px', marginBottom: 16, transition: 'border-color 0.2s, box-shadow 0.2s' },
  searchInput: { flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: isDark ? '#f1f5f9' : '#1e293b', fontFamily: 'inherit' },
  clearBtn: { background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 8, width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'background 0.15s' },

  /* Categories - Attractive Pills */
  catSection: { position: 'relative', marginBottom: 20 },
  catArrow: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 10, width: 28, height: 28, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)', border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: isDark ? '#94a3b8' : '#64748b', fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  catScroll: { display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', padding: '4px 24px', scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' },
  catPill: { flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 50, border: isDark ? '2px solid rgba(255,255,255,0.10)' : '2px solid rgba(0,0,0,0.06)', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)', color: isDark ? '#cbd5e1' : '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  catBadge: { background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.35)', borderRadius: 50, padding: '2px 8px', fontSize: 11, fontWeight: 700, marginLeft: 2 },

  /* Grid & List - Responsive */
  grid: { display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },

  /* Skeleton */
  skelCard: { borderRadius: 18, overflow: 'hidden', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.5)', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.04)', animation: 'fadeUp 0.4s ease both' },
  skelImg: { height: 160, background: isDark ? 'linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%)' : 'linear-gradient(90deg,rgba(0,0,0,0.04) 25%,rgba(0,0,0,0.07) 50%,rgba(0,0,0,0.04) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' },
  skelBody: { padding: 16 },
  skelLine: { height: 14, borderRadius: 8, marginBottom: 10, background: isDark ? 'linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%)' : 'linear-gradient(90deg,rgba(0,0,0,0.04) 25%,rgba(0,0,0,0.07) 50%,rgba(0,0,0,0.04) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' },

  /* Empty */
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', textAlign: 'center', animation: 'fadeUp 0.5s ease both' },
  emptyIcon: { fontSize: 48, marginBottom: 14, animation: 'float 3s ease-in-out infinite' },
  emptyTitle: { margin: 0, fontSize: 18, fontWeight: 800, color: isDark ? '#f1f5f9' : '#1e293b' },
  emptyDesc: { margin: '6px 0 0', fontSize: 14, color: '#94a3b8' },
  emptyBtn: { marginTop: 18, padding: '11px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #f97316, #e11d48)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 20px rgba(249,115,22,0.3)', transition: 'all 0.2s' },

  /* Card */
  card: { borderRadius: 18, overflow: 'hidden', background: isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)', boxShadow: isDark ? '0 2px 16px rgba(0,0,0,0.3)' : '0 2px 16px rgba(0,0,0,0.05)', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)' },
  cardImgWrap: { position: 'relative', height: 180, overflow: 'hidden', background: isDark ? 'linear-gradient(135deg, #1e293b, #0f172a)' : 'linear-gradient(135deg, #f8fafc, #f1f5f9)' },
  cardImg: { width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1)' },
  cardImgPH: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 50, fontSize: 11, fontWeight: 700, backdropFilter: 'blur(8px)' },
  catTag: { position: 'absolute', bottom: 10, left: 10, padding: '4px 10px', borderRadius: 50, fontSize: 10, fontWeight: 800, color: '#fff' },
  cardBody: { padding: '14px 16px 16px' },
  cardName: { margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: isDark ? '#f1f5f9' : '#1e293b', lineHeight: 1.3 },
  cardDesc: { margin: '0 0 10px', fontSize: 12, color: isDark ? '#94a3b8' : '#94a3b8', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  cardFoot: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.04)' },
  cardPrice: { fontSize: 18, fontWeight: 900, background: 'linear-gradient(135deg, #f97316, #e11d48)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  cardActions: { display: 'flex', alignItems: 'center', gap: 4 },

  /* Action Buttons */
  actionBtn: { width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' },
  editAction: { background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', color: isDark ? '#94a3b8' : '#64748b' },
  deleteAction: { background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', color: isDark ? '#94a3b8' : '#64748b' },

  /* Row */
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, background: isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.04)', boxShadow: isDark ? '0 1px 8px rgba(0,0,0,0.3)' : '0 1px 8px rgba(0,0,0,0.03)', transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)' },
  rowImgWrap: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: isDark ? 'linear-gradient(135deg, #1e293b, #0f172a)' : 'linear-gradient(135deg, #f8fafc, #f1f5f9)' },
  rowImg: { width: '100%', height: '100%', objectFit: 'cover' },
  rowImgPH: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1, minWidth: 0 },
  rowInfoTop: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rowName: { margin: 0, fontSize: 14, fontWeight: 700, color: isDark ? '#f1f5f9' : '#1e293b' },
  rowCat: { padding: '2px 8px', borderRadius: 50, fontSize: 10, fontWeight: 700, color: '#fff' },
  rowUnavail: { padding: '2px 8px', borderRadius: 50, fontSize: 10, fontWeight: 700, color: '#e11d48', background: 'rgba(244,63,94,0.08)' },
  rowDesc: { margin: '3px 0 0', fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowPrice: { fontSize: 16, fontWeight: 900, flexShrink: 0, background: 'linear-gradient(135deg, #f97316, #e11d48)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  rowActions: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },

  /* Modal */
  overlay: { position: 'fixed', inset: 0, zIndex: 100, background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, animation: 'fadeIn 0.2s ease both' },
  modal: { background: isDark ? '#1e293b' : '#fff', borderRadius: 20, width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto', boxShadow: isDark ? '0 24px 80px rgba(0,0,0,0.6)' : '0 24px 80px rgba(0,0,0,0.2)', animation: 'slideModal 0.35s cubic-bezier(0.4,0,0.2,1)' },
  modalHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 16px', borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)' },
  modalHeadLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  modalIcon: { width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #f97316, #e11d48)', boxShadow: '0 4px 14px rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { margin: 0, fontSize: 16, fontWeight: 800, color: isDark ? '#f1f5f9' : '#0f172a' },
  modalSub: { margin: '2px 0 0', fontSize: 12, color: isDark ? '#94a3b8' : '#94a3b8' },
  modalClose: { width: 34, height: 34, borderRadius: 10, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', transition: 'background 0.15s' },
  modalBody: { padding: 20 },
});

export default MenuManagement;

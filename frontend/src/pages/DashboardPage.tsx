import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Customer, hasPermission } from '../types';

type Results = { customers: number | null; products: number | null; lowStock: number | null; challans: number | null };
const empty: Results = { customers: null, products: null, lowStock: null, challans: null };

export default function DashboardPage() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Results>(empty);
  const [recent, setRecent] = useState<Customer[]>([]);
  const [customerError, setCustomerError] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const customerAccess = !!user && hasPermission(user.role, 'manage_customers');
  const productAccess = !!user && hasPermission(user.role, 'manage_products');
  const challanAccess = !!user && (hasPermission(user.role, 'manage_challans') || hasPermission(user.role, 'view_reports'));

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true);
      const [customers, products, lowStock, challans] = await Promise.allSettled([
        customerAccess ? api.getCustomers({ limit: 100 }) : Promise.resolve(null),
        productAccess ? api.getProducts({ limit: 1 }) : Promise.resolve(null),
        productAccess ? api.getProducts({ lowStock: true, limit: 1 }) : Promise.resolve(null),
        challanAccess ? api.getChallans({ limit: 1 }) : Promise.resolve(null),
      ]);
      if (!live) return;
      setCounts({
        customers: customers.status === 'fulfilled' ? customers.value?.pagination.total ?? null : null,
        products: products.status === 'fulfilled' ? products.value?.pagination.total ?? null : null,
        lowStock: lowStock.status === 'fulfilled' ? lowStock.value?.pagination.total ?? null : null,
        challans: challans.status === 'fulfilled' ? challans.value?.pagination.total ?? null : null,
      });
      setRecent(customers.status === 'fulfilled' ? customers.value?.data ?? [] : []);
      setCustomerError(customerAccess && customers.status === 'rejected');
      setFailed([customers, products, lowStock, challans].some((r) => r.status === 'rejected'));
      setLoading(false);
    }
    load();
    return () => { live = false; };
  }, [customerAccess, productAccess, challanAccess]);

  const metrics = [
    ...(customerAccess ? [{ label: 'Customers', value: counts.customers, icon: '◎', tone: 'violet', to: '/customers', hint: 'All customer records' }] : []),
    ...(productAccess ? [{ label: 'Products', value: counts.products, icon: '◇', tone: 'teal', to: '/products', hint: 'Items in your catalog' }, { label: 'Low stock', value: counts.lowStock, icon: '◈', tone: 'amber', to: '/products', hint: 'Items at or below minimum' }] : []),
    ...(challanAccess ? [{ label: 'Challans', value: counts.challans, icon: '▤', tone: 'blue', to: user && hasPermission(user.role, 'manage_challans') ? '/challans' : '/reports', hint: 'Records you can access' }] : []),
  ];
  const statuses = ['Lead', 'Active', 'Inactive'] as const;
  const groups = statuses.map((name) => ({ name, count: recent.filter((c) => c.status === name).length }));
  const total = recent.length;
  const maxStatus = Math.max(1, ...groups.map((item) => item.count));

  return (
    <div className="dashboard">
      <div className="dash-heading">
        <div><div className="dash-eyebrow"><span /> YOUR WORKSPACE</div><h2>Dashboard</h2><p>Welcome back, {user?.name}. Here's your business at a glance.</p></div>
        {customerAccess && <Link className="dash-primary" to="/customers/new">+ Add customer</Link>}
      </div>
      {failed && <p className="dash-error" role="alert">Some information could not be loaded. Try refreshing the page.</p>}
      <section className="dash-metrics" aria-label="Business overview">
        {metrics.map((m) => <Link to={m.to} key={m.label} className="dash-card dash-metric"><span className={`dash-icon ${m.tone}`}>{m.icon}</span><div><div className="dash-label">{m.label}</div><div className="dash-value">{loading ? '…' : m.value === null ? '—' : m.value.toLocaleString()}</div><div className="dash-hint">{m.value === null && !loading ? 'Unavailable' : m.hint}</div></div><span className="dash-arrow">↗</span></Link>)}
      </section>
      {customerAccess && <div className="dash-grid">
        <section className="dash-card dash-panel">
          <div className="dash-panel-heading"><div><div className="dash-eyebrow"><span /> CUSTOMER INSIGHTS</div><h3>Customer overview</h3><p>Status of the latest {total} customer{total === 1 ? '' : 's'}{counts.customers !== null && counts.customers > total ? ' (up to 100)' : ''}.</p></div><Link to="/customers">View all →</Link></div>
          {customerError ? <div className="dash-empty">Customer information is unavailable.</div> : loading ? <div className="dash-empty">Loading customer insights…</div> : total === 0 ? <div className="dash-empty">No customers yet. Add your first customer to see insights here.</div> : <div className="dash-bars">{groups.map((g, i) => <div className="dash-bar-row" key={g.name}><div className="dash-bar-label"><span><i className={`dot dot-${i}`} />{g.name}</span><strong>{g.count}</strong></div><div className="dash-track"><div className={`dash-bar bar-${i}`} style={{ width: `${g.count / maxStatus * 100}%` }} /></div></div>)}</div>}
        </section>
        <section className="dash-card dash-panel dash-quick">
          <div className="dash-eyebrow"><span /> QUICK ACTIONS</div><h3>Get things done.</h3><p>Everything you need, in one place.</p>
          {customerAccess && <Link to="/customers/new"><span>＋</span> Add a customer <b>↗</b></Link>}
          {productAccess && <Link to="/products/new"><span>◇</span> Add a product <b>↗</b></Link>}
          {user && hasPermission(user.role, 'manage_challans') && <Link to="/challans/new"><span>▤</span> Create a challan <b>↗</b></Link>}
          {user && hasPermission(user.role, 'view_reports') && <Link to="/reports"><span>▥</span> View reports <b>↗</b></Link>}
        </section>
      </div>}
      {customerAccess && <section className="dash-card dash-panel dash-recent">
        <div className="dash-panel-heading"><div><div className="dash-eyebrow"><span /> CUSTOMER ACTIVITY</div><h3>Recent customers</h3><p>Your latest customer records.</p></div><Link to="/customers">View all →</Link></div>
        {customerError ? <div className="dash-empty">Customer information is unavailable.</div> : loading ? <div className="dash-empty">Loading customers…</div> : recent.length === 0 ? <div className="dash-empty">No customer records yet.</div> : <div className="dash-table-wrap"><table><thead><tr><th>Customer</th><th>Business</th><th>Status</th><th></th></tr></thead><tbody>{recent.slice(0, 5).map((c) => <tr key={c.id}><td><span className="dash-avatar">{c.name.charAt(0).toUpperCase()}</span>{c.name}</td><td>{c.businessName || '—'}</td><td><span className={`dash-status ${c.status.toLowerCase()}`}>{c.status}</span></td><td><Link to={`/customers/${c.id}`}>View →</Link></td></tr>)}</tbody></table></div>}
      </section>}
    </div>
  );
}

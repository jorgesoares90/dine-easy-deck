import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";
import {
  LayoutGrid, ListOrdered, Table as TableIcon, ChefHat, Wallet,
  UtensilsCrossed, Layers, MapPin, Bot, Zap, MessageSquare,
  BarChart3, Users, Store, QrCode, ShieldCheck, Plug, CreditCard,
  LogOut, Loader2, Plus, Bell, Search, CheckCircle2, Trash2, Printer, Pencil, X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Comanda Fácil — Backoffice" }] }),
  component: StaffPage,
});

type Tenant = { id: string; name: string; slug: string };
type RestaurantTable = { id: string; number: number; status: string; capacity: number };
type Order = { id: string; status: string; total: number; created_at: string; table_id: string | null };
type OrderItem = { id: string; status: string; created_at: string; order_id: string; quantity: number; product_name: string | null };

type NavKey =
  | "overview" | "orders" | "tables" | "kds" | "cashier"
  | "products" | "modifiers" | "delivery_areas"
  | "ai_agent" | "automations" | "conversations"
  | "reports_sales" | "reports_clients"
  | "settings_store" | "settings_qr" | "settings_users" | "settings_integrations" | "settings_plan";

const NAV: { group: string; items: { key: NavKey; label: string; icon: any; badge?: number }[] }[] = [
  {
    group: "Operação",
    items: [
      { key: "overview", label: "Visão geral", icon: LayoutGrid },
      { key: "orders", label: "Pedidos", icon: ListOrdered },
      { key: "tables", label: "Salão e mesas", icon: TableIcon },
      { key: "kds", label: "Cozinha (KDS)", icon: ChefHat },
      { key: "cashier", label: "Caixa", icon: Wallet },
    ],
  },
  {
    group: "Cardápio",
    items: [
      { key: "products", label: "Produtos", icon: UtensilsCrossed },
      { key: "modifiers", label: "Adicionais e variações", icon: Layers },
      { key: "delivery_areas", label: "Áreas de entrega", icon: MapPin },
    ],
  },
  {
    group: "Atendimento e IA",
    items: [
      { key: "ai_agent", label: "Agente de IA", icon: Bot },
      { key: "automations", label: "Automações e disparos", icon: Zap },
      { key: "conversations", label: "Conversas", icon: MessageSquare },
    ],
  },
  {
    group: "Relatórios",
    items: [
      { key: "reports_sales", label: "Vendas e fechamento", icon: BarChart3 },
      { key: "reports_clients", label: "Clientes", icon: Users },
    ],
  },
  {
    group: "Configurações",
    items: [
      { key: "settings_store", label: "Dados da loja", icon: Store },
      { key: "settings_qr", label: "QR Codes das mesas", icon: QrCode },
      { key: "settings_users", label: "Usuários e permissões", icon: ShieldCheck },
      { key: "settings_integrations", label: "Integrações", icon: Plug },
      { key: "settings_plan", label: "Plano e assinatura", icon: CreditCard },
    ],
  },
];

function StaffPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [active, setActive] = useState<NavKey>("overview");
  const [ordersCount, setOrdersCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/auth" }); return; }
      setUser(user);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("tenant_id, role, tenants(*)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (roles?.tenants) setTenant(roles.tenants as any);
      setLoading(false);
    })();
  }, [navigate]);

  useEffect(() => {
    if (!tenant) return;
    const update = async () => {
      const { count } = await supabase
        .from("orders").select("*", { count: "exact", head: true })
        .eq("tenant_id", tenant.id).in("status", ["aberto", "enviado"]);
      setOrdersCount(count ?? 0);
    };
    update();
    const ch = supabase.channel(`orders-count-${tenant.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `tenant_id=eq.${tenant.id}` }, update)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenant]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  async function createDemoTenant() {
    if (!user) return;
    setLoading(true);
    const slug = `restaurante-${user.id.slice(0, 6)}`;
    const { data: t, error } = await supabase
      .from("tenants").insert({ name: "Meu Restaurante", slug }).select().single();
    if (error) { alert(error.message); setLoading(false); return; }
    await supabase.from("user_roles").insert({ user_id: user.id, tenant_id: t.id, role: "owner" });
    setTenant(t as any);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-line p-6">
          <h1 className="text-xl font-bold mb-2 text-ink">Bem-vindo, {user?.email}</h1>
          <p className="text-ink-muted text-sm mb-4">
            Você ainda não tem um restaurante. Crie agora para começar a operar.
          </p>
          <button onClick={createDemoTenant}
            className="w-full bg-brand text-white py-2.5 rounded-xl font-semibold hover:bg-brand-dark transition">
            Criar meu restaurante
          </button>
          <button onClick={handleSignOut} className="w-full mt-2 text-sm text-ink-muted hover:text-ink">
            Sair
          </button>
        </div>
      </div>
    );
  }

  const initials = (user?.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-app text-ink">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 bg-cream/95 backdrop-blur border-b border-line p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white">
            <UtensilsCrossed className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">Comanda Fácil</div>
            <div className="text-[11px] text-ink-muted leading-tight">{tenant.name}</div>
          </div>
        </div>
        <button onClick={handleSignOut} className="p-2 rounded-lg hover:bg-cream-dark">
          <LogOut className="w-4 h-4 text-ink-muted" />
        </button>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:flex w-72 shrink-0 bg-cream border-r border-line flex-col sticky top-0 h-screen">
          <div className="p-5 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand flex items-center justify-center text-white shadow-sm">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-ink leading-tight">Comanda Fácil</div>
              <div className="text-xs text-ink-muted truncate">{tenant.name}</div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-5">
            {NAV.map(group => (
              <div key={group.group}>
                <div className="px-3 mb-1.5 text-[11px] uppercase tracking-wider text-ink-muted/80 font-medium">
                  {group.group}
                </div>
                <ul className="space-y-0.5">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const isActive = active === item.key;
                    const badge = item.key === "orders" ? ordersCount : undefined;
                    return (
                      <li key={item.key}>
                        <button
                          onClick={() => setActive(item.key)}
                          className={`group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                            isActive
                              ? "bg-brand-soft text-brand-dark"
                              : "text-ink-soft hover:bg-cream-dark hover:text-ink"
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isActive ? "text-brand" : "text-ink-muted group-hover:text-ink"}`} />
                          <span className="flex-1 text-left">{item.label}</span>
                          {badge ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand text-white">
                              {badge}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="p-3 border-t border-line">
            <button onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink-muted hover:bg-cream-dark hover:text-ink">
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          {/* Desktop header */}
          <div className="hidden md:flex items-center justify-between px-8 py-5 border-b border-line bg-app">
            <h1 className="text-xl font-bold tracking-tight">
              {NAV.flatMap(g => g.items).find(i => i.key === active)?.label}
            </h1>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-cream-dark text-ink-muted">
                <Search className="w-4 h-4" />
              </button>
              <button className="p-2 rounded-lg hover:bg-cream-dark text-ink-muted relative">
                <Bell className="w-4 h-4" />
                {ordersCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand" />
                )}
              </button>
              <div className="w-9 h-9 rounded-full bg-sage text-white flex items-center justify-center text-xs font-semibold">
                {initials}
              </div>
            </div>
          </div>

          {/* Mobile section tabs */}
          <div className="md:hidden flex overflow-x-auto border-b border-line bg-cream/50 px-2 gap-1 py-2 no-scrollbar">
            {NAV.flatMap(g => g.items).map(item => (
              <button key={item.key} onClick={() => setActive(item.key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${
                  active === item.key ? "bg-brand text-white" : "text-ink-muted bg-white border border-line"
                }`}>
                {item.label}
              </button>
            ))}
          </div>

          <div className="p-4 md:p-8">
            {active === "overview" && <OverviewSection tenantId={tenant.id} />}
            {active === "orders" && <OrdersSection tenantId={tenant.id} />}
            {active === "tables" && <TablesSection tenantId={tenant.id} />}
            {active === "kds" && <KDSSection tenantId={tenant.id} />}
            {active === "cashier" && <Placeholder title="Caixa" desc="Abertura/fechamento de caixa, sangrias e relatórios." />}
            {active === "products" && <ProductsSection tenantId={tenant.id} />}
            {active === "modifiers" && <Placeholder title="Adicionais e variações" desc="Configure complementos, tamanhos e opções." />}
            {active === "delivery_areas" && <Placeholder title="Áreas de entrega" desc="Defina bairros, raios e taxas de entrega." />}
            {active === "ai_agent" && <Placeholder title="Agente de IA" desc="Atendimento automático no WhatsApp." />}
            {active === "automations" && <Placeholder title="Automações e disparos" desc="Campanhas e mensagens automáticas." />}
            {active === "conversations" && <Placeholder title="Conversas" desc="Caixa de entrada unificada do WhatsApp." />}
            {active === "reports_sales" && <Placeholder title="Vendas e fechamento" desc="Relatórios financeiros por período." />}
            {active === "reports_clients" && <Placeholder title="Clientes" desc="CRM e histórico de pedidos." />}
            {active === "settings_store" && <Placeholder title="Dados da loja" desc="Nome, logo, horário e contato." />}
            {active === "settings_qr" && <QRSection tenantId={tenant.id} />}
            {active === "settings_users" && <Placeholder title="Usuários e permissões" desc="Gestor, garçom, cozinha e caixa." />}
            {active === "settings_integrations" && <Placeholder title="Integrações" desc="Pagamentos, impressoras e webhooks." />}
            {active === "settings_plan" && <Placeholder title="Plano e assinatura" desc="Faturas, plano atual e upgrades." />}

            <div className="mt-10 pt-6 border-t border-line text-xs text-ink-muted">
              <Link to="/" className="hover:text-brand">← Voltar para protótipo público</Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ---------------- Overview ---------------- */
function OverviewSection({ tenantId }: { tenantId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("orders").select("*").eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }).limit(20);
      setOrders((data as any) ?? []);
    };
    load();
    const ch = supabase.channel(`overview-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `tenant_id=eq.${tenantId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId]);

  const today = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const dayOrders = orders.filter(o => new Date(o.created_at) >= start);
    const revenue = dayOrders.reduce((s, o) => s + Number(o.total ?? 0), 0);
    return {
      count: dayOrders.length,
      revenue,
      ticket: dayOrders.length ? revenue / dayOrders.length : 0,
    };
  }, [orders]);

  const active = orders.filter(o => o.status === "aberto" || o.status === "enviado").slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Metric label="Pedidos hoje" value={String(today.count)} accent="cream" />
        <Metric label="Faturamento" value={`R$ ${today.revenue.toFixed(2)}`} accent="cream" />
        <Metric label="Ticket médio" value={`R$ ${today.ticket.toFixed(2)}`} accent="cream" />
      </div>

      <section>
        <h2 className="text-sm text-ink-muted mb-2">Pedidos em andamento</h2>
        <div className="bg-white border border-line rounded-2xl divide-y divide-line overflow-hidden">
          {active.length === 0 ? (
            <div className="p-8 text-center text-ink-muted text-sm">Nenhum pedido em andamento.</div>
          ) : active.map(o => (
            <div key={o.id} className="p-4 flex items-center gap-3">
              <ChannelBadge order={o} />
              <div className="flex-1 min-w-0 text-sm text-ink truncate">
                Pedido <span className="font-mono text-ink-muted">#{o.id.slice(0, 8)}</span>
                <span className="text-ink-muted"> · {new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="font-semibold text-ink whitespace-nowrap">R$ {Number(o.total).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ChannelBadge({ order }: { order: Order }) {
  // table_id present => Mesa, otherwise default Balcão. (Delivery would need additional column.)
  const isTable = !!order.table_id;
  const cls = isTable
    ? "bg-sage-soft text-sage-dark"
    : "bg-mustard-soft text-mustard-dark";
  return (
    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${cls}`}>
      {isTable ? "Mesa" : "Balcão"}
    </span>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent: "cream" }) {
  void accent;
  return (
    <div className="rounded-2xl bg-cream border border-line p-5">
      <div className="text-sm text-ink-muted">{label}</div>
      <div className="text-3xl font-bold text-ink mt-1 tracking-tight">{value}</div>
    </div>
  );
}

/* ---------------- Orders ---------------- */
function OrdersSection({ tenantId }: { tenantId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("orders").select("*")
        .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50);
      setOrders((data as any) ?? []);
    };
    load();
    const ch = supabase.channel(`orders-list-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `tenant_id=eq.${tenantId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId]);

  return (
    <div className="bg-white border border-line rounded-2xl overflow-hidden">
      {orders.length === 0 ? (
        <div className="p-10 text-center text-ink-muted text-sm">Nenhum pedido ainda.</div>
      ) : (
        <ul className="divide-y divide-line">
          {orders.map(o => (
            <li key={o.id} className="p-4 flex items-center gap-3">
              <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                o.status === "fechado" ? "bg-sage-soft text-sage-dark"
                : o.status === "cancelado" ? "bg-rose-100 text-rose-700"
                : "bg-mustard-soft text-mustard-dark"
              }`}>{o.status}</span>
              <span className="font-mono text-xs text-ink-muted">#{o.id.slice(0, 8)}</span>
              <span className="text-sm text-ink-muted flex-1">
                {new Date(o.created_at).toLocaleString("pt-BR")}
              </span>
              <span className="font-semibold">R$ {Number(o.total).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- Tables ---------------- */
function TablesSection({ tenantId }: { tenantId: string }) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [adding, setAdding] = useState(false);

  async function load() {
    const { data } = await supabase.from("restaurant_tables")
      .select("*").eq("tenant_id", tenantId).order("number");
    setTables((data as any) ?? []);
  }
  useEffect(() => { load(); }, [tenantId]);

  async function addTable() {
    setAdding(true);
    const next = (tables[tables.length - 1]?.number ?? 0) + 1;
    const token = crypto.randomUUID();
    const { error } = await supabase.from("restaurant_tables").insert({
      tenant_id: tenantId, number: next, capacity: 4, qr_token: token, status: "livre",
    });
    if (error) alert(error.message);
    await load();
    setAdding(false);
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <button onClick={addTable} disabled={adding}
          className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-brand-dark disabled:opacity-60">
          <Plus className="w-4 h-4" /> Nova mesa
        </button>
      </div>
      {tables.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-10 text-center text-ink-muted">
          Nenhuma mesa cadastrada.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {tables.map(t => (
            <div key={t.id} className="bg-white border border-line rounded-2xl p-4 text-center">
              <TableIcon className="w-6 h-6 mx-auto text-ink-muted mb-1" />
              <div className="font-bold text-lg">Mesa {t.number}</div>
              <div className="text-xs text-ink-muted">{t.capacity} lugares</div>
              <div className={`mt-2 text-xs px-2 py-1 rounded-full inline-block ${
                t.status === "livre" ? "bg-sage-soft text-sage-dark"
                : t.status === "ocupada" ? "bg-mustard-soft text-mustard-dark"
                : "bg-brand-soft text-brand-dark"
              }`}>{t.status}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- KDS ---------------- */
function KDSSection({ tenantId }: { tenantId: string }) {
  const [items, setItems] = useState<OrderItem[]>([]);

  async function load() {
    const { data } = await supabase
      .from("order_items")
      .select("id, status, created_at, order_id, quantity, product_name, orders!inner(tenant_id)")
      .eq("orders.tenant_id", tenantId)
      .in("status", ["recebido", "em_preparo"])
      .order("created_at");
    setItems((data as any) ?? []);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel(`kds-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId]);

  async function advance(it: OrderItem) {
    const next = it.status === "recebido" ? "em_preparo" : "finalizado";
    await supabase.from("order_items").update({ status: next }).eq("id", it.id);
  }

  const cols = [
    { key: "recebido", label: "Recebido", accent: "bg-brand" },
    { key: "em_preparo", label: "Em preparo", accent: "bg-mustard" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {cols.map(col => (
        <div key={col.key} className="bg-white rounded-2xl border border-line overflow-hidden">
          <div className="p-3 border-b border-line flex items-center gap-2 font-semibold">
            <span className={`w-2 h-2 rounded-full ${col.accent}`} />
            {col.label}
            <span className="ml-auto text-xs text-ink-muted font-normal">
              {items.filter(o => o.status === col.key).length}
            </span>
          </div>
          <div className="p-3 space-y-2 min-h-40">
            {items.filter(o => o.status === col.key).map(it => (
              <div key={it.id} className="border border-line rounded-xl p-3 bg-cream/40">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{it.quantity}× {it.product_name ?? "Item"}</span>
                  <span className="text-xs text-ink-muted">
                    {new Date(it.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="font-mono text-xs text-ink-muted mt-1">#{it.order_id.slice(0, 8)}</div>
                <button onClick={() => advance(it)}
                  className="mt-2 w-full flex items-center justify-center gap-2 bg-ink text-white text-xs py-2 rounded-lg hover:bg-ink/90">
                  <CheckCircle2 className="w-3 h-3" />
                  {col.key === "recebido" ? "Iniciar preparo" : "Finalizar"}
                </button>
              </div>
            ))}
            {items.filter(o => o.status === col.key).length === 0 && (
              <div className="text-xs text-ink-muted/60 text-center py-6">Vazio</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Placeholder ---------------- */
function Placeholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-white border border-line rounded-2xl p-10 text-center">
      <div className="inline-flex w-12 h-12 rounded-2xl bg-brand-soft text-brand items-center justify-center mb-3">
        <UtensilsCrossed className="w-5 h-5" />
      </div>
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      <p className="text-sm text-ink-muted mt-1 max-w-md mx-auto">{desc}</p>
      <span className="inline-block mt-4 text-[11px] uppercase tracking-wider bg-cream-dark text-ink-muted px-2.5 py-1 rounded-full">Em breve</span>
    </div>
  );
}

/* ---------------- Products & Categories ---------------- */
type Category = { id: string; name: string; position: number; is_active: boolean };
type Product = { id: string; category_id: string | null; name: string; description: string | null; price: number; is_active: boolean; position: number };

function ProductsSection({ tenantId }: { tenantId: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  async function loadAll() {
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from("categories").select("*").eq("tenant_id", tenantId).order("position"),
      supabase.from("products").select("*").eq("tenant_id", tenantId).order("position"),
    ]);
    setCategories((cats as any) ?? []);
    setProducts((prods as any) ?? []);
    if (!selectedCat && cats && cats.length) setSelectedCat((cats[0] as any).id);
  }
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [tenantId]);

  async function addCategory() {
    const name = newCatName.trim();
    if (!name) return;
    const { error } = await supabase.from("categories").insert({
      tenant_id: tenantId, name, position: categories.length, is_active: true,
    });
    if (error) return alert(error.message);
    setNewCatName("");
    await loadAll();
  }

  async function deleteCategory(id: string) {
    if (!confirm("Excluir categoria e todos os produtos dela?")) return;
    await supabase.from("products").delete().eq("category_id", id);
    await supabase.from("categories").delete().eq("id", id);
    if (selectedCat === id) setSelectedCat(null);
    await loadAll();
  }

  async function saveProduct() {
    if (!editingProduct || !editingProduct.name) return;
    const payload: any = {
      tenant_id: tenantId,
      category_id: editingProduct.category_id ?? selectedCat,
      name: editingProduct.name,
      description: editingProduct.description ?? null,
      price: Number(editingProduct.price ?? 0),
      is_active: editingProduct.is_active ?? true,
      position: editingProduct.position ?? products.length,
    };
    const { error } = editingProduct.id
      ? await supabase.from("products").update(payload).eq("id", editingProduct.id)
      : await supabase.from("products").insert(payload);
    if (error) return alert(error.message);
    setEditingProduct(null);
    await loadAll();
  }

  async function deleteProduct(id: string) {
    if (!confirm("Excluir produto?")) return;
    await supabase.from("products").delete().eq("id", id);
    await loadAll();
  }

  const visible = selectedCat ? products.filter(p => p.category_id === selectedCat) : products;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      <aside className="bg-white border border-line rounded-2xl p-4">
        <h3 className="text-sm font-semibold mb-3">Categorias</h3>
        <div className="flex gap-2 mb-3">
          <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
            placeholder="Nova categoria"
            className="flex-1 px-3 py-2 text-sm border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/40" />
          <button onClick={addCategory}
            className="px-3 rounded-lg bg-brand text-white hover:bg-brand-dark"><Plus className="w-4 h-4" /></button>
        </div>
        <ul className="space-y-1">
          {categories.map(c => (
            <li key={c.id} className={`group flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer ${
              selectedCat === c.id ? "bg-brand-soft text-brand-dark" : "hover:bg-cream-dark text-ink-soft"
            }`} onClick={() => setSelectedCat(c.id)}>
              <span className="truncate">{c.name}</span>
              <button onClick={(e) => { e.stopPropagation(); deleteCategory(c.id); }}
                className="opacity-0 group-hover:opacity-100 text-ink-muted hover:text-rose-600">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
          {categories.length === 0 && <li className="text-xs text-ink-muted px-2 py-2">Sem categorias.</li>}
        </ul>
      </aside>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm text-ink-muted">
            {selectedCat ? categories.find(c => c.id === selectedCat)?.name : "Todos os produtos"} · {visible.length} {visible.length === 1 ? "item" : "itens"}
          </h3>
          <button
            disabled={!selectedCat && categories.length === 0}
            onClick={() => setEditingProduct({ category_id: selectedCat ?? undefined, name: "", price: 0, is_active: true })}
            className="flex items-center gap-2 bg-brand text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-brand-dark disabled:opacity-50">
            <Plus className="w-4 h-4" /> Novo produto
          </button>
        </div>

        {categories.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl p-10 text-center text-ink-muted text-sm">
            Crie uma categoria para começar a cadastrar produtos.
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl p-10 text-center text-ink-muted text-sm">
            Nenhum produto nesta categoria ainda.
          </div>
        ) : (
          <div className="bg-white border border-line rounded-2xl divide-y divide-line overflow-hidden">
            {visible.map(p => (
              <div key={p.id} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink truncate">{p.name}</div>
                  {p.description && <div className="text-xs text-ink-muted truncate">{p.description}</div>}
                </div>
                <div className="font-semibold whitespace-nowrap">R$ {Number(p.price).toFixed(2)}</div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${p.is_active ? "bg-sage-soft text-sage-dark" : "bg-cream-dark text-ink-muted"}`}>
                  {p.is_active ? "Ativo" : "Inativo"}
                </span>
                <button onClick={() => setEditingProduct(p)} className="p-1.5 text-ink-muted hover:text-ink"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => deleteProduct(p.id)} className="p-1.5 text-ink-muted hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      {editingProduct && (
        <ProductModal
          value={editingProduct}
          categories={categories}
          onChange={setEditingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={saveProduct}
        />
      )}
    </div>
  );
}

function ProductModal({ value, categories, onChange, onClose, onSave }: {
  value: Partial<Product>;
  categories: Category[];
  onChange: (v: Partial<Product>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h3 className="font-bold">{value.id ? "Editar produto" : "Novo produto"}</h3>
          <button onClick={onClose} className="p-1 text-ink-muted hover:text-ink"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Nome">
            <input value={value.name ?? ""} onChange={e => onChange({ ...value, name: e.target.value })}
              className="w-full px-3 py-2 border border-line rounded-lg" />
          </Field>
          <Field label="Descrição">
            <textarea value={value.description ?? ""} onChange={e => onChange({ ...value, description: e.target.value })}
              rows={2} className="w-full px-3 py-2 border border-line rounded-lg" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço (R$)">
              <input type="number" step="0.01" min="0" value={value.price ?? 0}
                onChange={e => onChange({ ...value, price: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-line rounded-lg" />
            </Field>
            <Field label="Categoria">
              <select value={value.category_id ?? ""} onChange={e => onChange({ ...value, category_id: e.target.value })}
                className="w-full px-3 py-2 border border-line rounded-lg bg-white">
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={value.is_active ?? true}
              onChange={e => onChange({ ...value, is_active: e.target.checked })} />
            Ativo no cardápio
          </label>
        </div>
        <div className="p-4 border-t border-line flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-cream-dark">Cancelar</button>
          <button onClick={onSave} className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand text-white hover:bg-brand-dark">Salvar</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-ink-muted font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

/* ---------------- QR Codes ---------------- */
function QRSection({ tenantId }: { tenantId: string }) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from("restaurant_tables")
      .select("*").eq("tenant_id", tenantId).order("number");
    const list = (data as any[]) ?? [];
    setTables(list);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const entries = await Promise.all(list.map(async (t) => {
      const url = `${origin}/m/${t.qr_token}`;
      const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: "#3a2118", light: "#ffffff" } });
      return [t.id, dataUrl] as const;
    }));
    setQrs(Object.fromEntries(entries));
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tenantId]);

  async function bulkCreate() {
    if (count < 1 || count > 100) return alert("Escolha entre 1 e 100 mesas.");
    setBusy(true);
    const startNum = (tables[tables.length - 1]?.number ?? 0) + 1;
    const rows = Array.from({ length: count }, (_, i) => ({
      tenant_id: tenantId,
      number: startNum + i,
      capacity: 4,
      qr_token: crypto.randomUUID(),
      status: "livre" as const,
    }));
    const { error } = await supabase.from("restaurant_tables").insert(rows);
    if (error) alert(error.message);
    await load();
    setBusy(false);
  }

  async function deleteTable(id: string) {
    if (!confirm("Excluir mesa? Sessões em andamento serão fechadas.")) return;
    await supabase.from("restaurant_tables").delete().eq("id", id);
    await load();
  }

  function printAll() {
    const html = `
      <html><head><title>QR Codes — Mesas</title>
      <style>
        body{font-family:sans-serif;margin:0;padding:24px;background:#fff}
        .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px}
        .card{border:1px solid #ddd;border-radius:16px;padding:20px;text-align:center;page-break-inside:avoid}
        .num{font-size:28px;font-weight:800;color:#3a2118;margin-bottom:8px}
        img{width:100%;max-width:280px;height:auto}
        .hint{margin-top:10px;color:#777;font-size:12px}
      </style></head><body>
      <div class="grid">
        ${tables.map(t => `
          <div class="card">
            <div class="num">Mesa ${t.number}</div>
            <img src="${qrs[t.id] ?? ""}" />
            <div class="hint">Aponte a câmera do celular</div>
          </div>`).join("")}
      </div>
      <script>window.onload=()=>window.print()</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  return (
    <div>
      <div className="bg-white border border-line rounded-2xl p-5 mb-6 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold text-ink mb-1">Criar mesas em lote</div>
          <p className="text-xs text-ink-muted">Cada mesa recebe um QR Code único. Você pode criar mais a qualquer momento.</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <span className="text-xs text-ink-muted">Quantidade</span>
            <input type="number" min={1} max={100} value={count}
              onChange={e => setCount(Number(e.target.value))}
              className="block w-28 mt-1 px-3 py-2 border border-line rounded-lg" />
          </div>
          <button onClick={bulkCreate} disabled={busy}
            className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-brand-dark disabled:opacity-60">
            <Plus className="w-4 h-4" /> Gerar
          </button>
          {tables.length > 0 && (
            <button onClick={printAll}
              className="flex items-center gap-2 bg-ink text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-ink/90">
              <Printer className="w-4 h-4" /> Imprimir
            </button>
          )}
        </div>
      </div>

      {tables.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-10 text-center text-ink-muted text-sm">
          Nenhuma mesa cadastrada ainda.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {tables.map(t => (
            <div key={t.id} className="bg-white border border-line rounded-2xl p-4 text-center">
              <div className="font-bold text-ink mb-2">Mesa {t.number}</div>
              {qrs[t.id] ? (
                <img src={qrs[t.id]} alt={`QR Mesa ${t.number}`} className="w-full rounded-lg border border-line" />
              ) : (
                <div className="aspect-square bg-cream-dark rounded-lg animate-pulse" />
              )}
              <div className="flex items-center justify-between mt-2 gap-2">
                <a href={`/m/${t.qr_token}`} target="_blank" rel="noreferrer"
                  className="text-[11px] text-brand hover:underline truncate">Abrir link</a>
                <button onClick={() => deleteTable(t.id)} className="text-ink-muted hover:text-rose-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

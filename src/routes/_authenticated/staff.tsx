import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, Table as TableIcon, ChefHat, LogOut, Loader2, Plus,
  DollarSign, ShoppingCart, Users, Clock, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [{ title: "Staff — Comanda Fácil" }],
  }),
  component: StaffPage,
});

type Tenant = { id: string; name: string; slug: string };
type RestaurantTable = { id: string; number: number; status: string; capacity: number };
type Order = { id: string; status: string; total: number; created_at: string; table_id: string | null };
type OrderItem = { id: string; status: string; created_at: string; order_id: string; quantity: number; name_snapshot: string | null };

type Tab = "dashboard" | "tables" | "kds";

function StaffPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/auth" }); return; }
      setUser(user);

      // load tenant from user_roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("tenant_id, role, tenants(*)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (roles?.tenants) {
        setTenant(roles.tenants as any);
      }
      setLoading(false);
    })();
  }, [navigate]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  async function createDemoTenant() {
    if (!user) return;
    setLoading(true);
    const slug = `restaurante-${user.id.slice(0, 6)}`;
    const { data: t, error } = await supabase
      .from("tenants")
      .insert({ name: "Meu Restaurante", slug })
      .select()
      .single();
    if (error) { alert(error.message); setLoading(false); return; }

    await supabase.from("user_roles").insert({
      user_id: user.id, tenant_id: t.id, role: "owner",
    });
    setTenant(t as any);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6 border">
          <h1 className="text-xl font-bold mb-2">Bem-vindo, {user?.email}</h1>
          <p className="text-slate-600 text-sm mb-4">
            Você ainda não tem um restaurante. Crie agora para começar a operar.
          </p>
          <button
            onClick={createDemoTenant}
            className="w-full bg-orange-600 text-white py-2.5 rounded-lg font-semibold hover:bg-orange-700"
          >
            Criar meu restaurante
          </button>
          <button onClick={handleSignOut} className="w-full mt-2 text-sm text-slate-500 hover:text-slate-700">
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 bg-white border-r flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-orange-600" />
            <div>
              <div className="font-bold text-sm">{tenant.name}</div>
              <div className="text-xs text-slate-400">{user?.email}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          <SideBtn icon={LayoutDashboard} label="Dashboard" active={tab === "dashboard"} onClick={() => setTab("dashboard")} />
          <SideBtn icon={TableIcon} label="Mesas" active={tab === "tables"} onClick={() => setTab("tables")} />
          <SideBtn icon={ChefHat} label="KDS Cozinha" active={tab === "kds"} onClick={() => setTab("kds")} />
        </nav>
        <button onClick={handleSignOut} className="m-2 p-2 flex items-center gap-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="md:hidden bg-white border-b p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-orange-600" />
            <span className="font-semibold text-sm">{tenant.name}</span>
          </div>
          <button onClick={handleSignOut} className="text-slate-500"><LogOut className="w-4 h-4" /></button>
        </header>
        <div className="md:hidden flex border-b bg-white">
          {(["dashboard", "tables", "kds"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium ${tab === t ? "text-orange-600 border-b-2 border-orange-600" : "text-slate-500"}`}>
              {t === "dashboard" ? "Dashboard" : t === "tables" ? "Mesas" : "KDS"}
            </button>
          ))}
        </div>

        <div className="p-4 md:p-6">
          {tab === "dashboard" && <DashboardTab tenantId={tenant.id} />}
          {tab === "tables" && <TablesTab tenantId={tenant.id} />}
          {tab === "kds" && <KDSTab tenantId={tenant.id} />}
        </div>

        <div className="px-4 md:px-6 pb-6">
          <Link to="/" className="text-xs text-slate-400 hover:text-orange-600">← Voltar para protótipo público</Link>
        </div>
      </main>
    </div>
  );
}

function SideBtn({ icon: Icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
        active ? "bg-orange-50 text-orange-700" : "text-slate-600 hover:bg-slate-100"
      }`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

/* ---------------- Dashboard ---------------- */
function DashboardTab({ tenantId }: { tenantId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20);
      setOrders((data as any) ?? []);
    })();

    const channel = supabase
      .channel(`orders-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `tenant_id=eq.${tenantId}` },
        async () => {
          const { data } = await supabase.from("orders").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20);
          setOrders((data as any) ?? []);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const totalDay = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const avgTicket = orders.length ? totalDay / orders.length : 0;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card icon={DollarSign} label="Vendas (período)" value={`R$ ${totalDay.toFixed(2)}`} color="bg-green-100 text-green-700" />
        <Card icon={ShoppingCart} label="Pedidos" value={String(orders.length)} color="bg-blue-100 text-blue-700" />
        <Card icon={Users} label="Ticket médio" value={`R$ ${avgTicket.toFixed(2)}`} color="bg-purple-100 text-purple-700" />
        <Card icon={Clock} label="Em preparo" value={String(orders.filter(o => o.status === "em_preparo").length)} color="bg-amber-100 text-amber-700" />
      </div>

      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b font-semibold">Últimos pedidos</div>
        {orders.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Nenhum pedido ainda.</div>
        ) : (
          <ul className="divide-y">
            {orders.map(o => (
              <li key={o.id} className="p-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-mono text-xs text-slate-400">#{o.id.slice(0, 8)}</div>
                  <div className="text-slate-600">{new Date(o.created_at).toLocaleString("pt-BR")}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    o.status === "finalizado" ? "bg-green-100 text-green-700"
                    : o.status === "em_preparo" ? "bg-amber-100 text-amber-700"
                    : "bg-blue-100 text-blue-700"
                  }`}>{o.status}</span>
                  <span className="font-semibold">R$ {Number(o.total).toFixed(2)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, value, color }: any) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className={`inline-flex p-2 rounded-lg ${color} mb-2`}><Icon className="w-4 h-4" /></div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

/* ---------------- Tables ---------------- */
function TablesTab({ tenantId }: { tenantId: string }) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [adding, setAdding] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("restaurant_tables")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("number");
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Mesas</h2>
        <button onClick={addTable} disabled={adding}
          className="flex items-center gap-2 bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-60">
          <Plus className="w-4 h-4" /> Nova mesa
        </button>
      </div>
      {tables.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-slate-400">
          Nenhuma mesa cadastrada.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {tables.map(t => (
            <div key={t.id} className="bg-white border rounded-xl p-4 text-center">
              <TableIcon className="w-6 h-6 mx-auto text-slate-400 mb-1" />
              <div className="font-bold text-lg">Mesa {t.number}</div>
              <div className="text-xs text-slate-500">{t.capacity} lugares</div>
              <div className={`mt-2 text-xs px-2 py-1 rounded-full inline-block ${
                t.status === "livre" ? "bg-green-100 text-green-700"
                : t.status === "ocupada" ? "bg-amber-100 text-amber-700"
                : "bg-blue-100 text-blue-700"
              }`}>{t.status}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- KDS ---------------- */
function KDSTab({ tenantId }: { tenantId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);

  async function load() {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("status", ["recebido", "em_preparo"])
      .order("created_at");
    setOrders((data as any) ?? []);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`kds-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `tenant_id=eq.${tenantId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  async function advance(o: Order) {
    const next = o.status === "recebido" ? "em_preparo" : "finalizado";
    await supabase.from("orders").update({ status: next }).eq("id", o.id);
  }

  const cols = [
    { key: "recebido", label: "Recebido", color: "border-blue-400" },
    { key: "em_preparo", label: "Em preparo", color: "border-amber-400" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">KDS — Cozinha</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cols.map(col => (
          <div key={col.key} className={`bg-white rounded-xl border-t-4 ${col.color}`}>
            <div className="p-3 border-b font-semibold">
              {col.label} ({orders.filter(o => o.status === col.key).length})
            </div>
            <div className="p-3 space-y-2 min-h-40">
              {orders.filter(o => o.status === col.key).map(o => (
                <div key={o.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-400">#{o.id.slice(0, 8)}</span>
                    <span className="text-xs text-slate-500">{new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <button onClick={() => advance(o)}
                    className="mt-2 w-full flex items-center justify-center gap-2 bg-slate-900 text-white text-xs py-2 rounded-lg hover:bg-slate-800">
                    <CheckCircle2 className="w-3 h-3" />
                    {col.key === "recebido" ? "Iniciar preparo" : "Finalizar"}
                  </button>
                </div>
              ))}
              {orders.filter(o => o.status === col.key).length === 0 && (
                <div className="text-xs text-slate-300 text-center py-6">Vazio</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

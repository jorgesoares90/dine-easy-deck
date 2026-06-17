import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  QrCode, Smartphone, ChefHat, UserCog, LayoutDashboard, ShoppingCart,
  Monitor, Users, Wallet, Settings, MenuSquare, Bell, Check, X,
  Plus, Minus, Clock, ArrowLeft, Receipt, TrendingUp, Table as TableIcon,
  DollarSign, ChevronRight, Search, Utensils, Coffee, Pizza, LogIn,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Comanda Fácil — SaaS para Restaurantes" },
      { name: "description", content: "Sistema multi-tenant para lanchonetes com pagamento parcial e captura de leads." },
    ],
  }),
  component: Index,
});

type Profile = "cliente" | "cozinha" | "garcom" | "gestor";

const PROFILES: { id: Profile; label: string; icon: any }[] = [
  { id: "cliente", label: "Cliente", icon: Smartphone },
  { id: "cozinha", label: "Cozinha", icon: ChefHat },
  { id: "garcom", label: "Garçom", icon: UserCog },
  { id: "gestor", label: "Gestor", icon: LayoutDashboard },
];

function Index() {
  const [profile, setProfile] = useState<Profile>("cliente");

  return (
    <div className="min-h-screen bg-slate-50">
      <Switcher current={profile} onChange={setProfile} />
      <div className="pt-20">
        {profile === "cliente" && <ClienteView />}
        {profile === "cozinha" && <CozinhaView />}
        {profile === "garcom" && <GarcomView />}
        {profile === "gestor" && <GestorView />}
      </div>
    </div>
  );
}

/* ---------------- Switcher ---------------- */
function Switcher({ current, onChange }: { current: Profile; onChange: (p: Profile) => void }) {
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-white/90 backdrop-blur border border-slate-200 shadow-lg rounded-full px-2 py-2 flex gap-1">
      {PROFILES.map((p) => {
        const Icon = p.icon;
        const active = current === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition ${
              active ? "bg-orange-600 text-white shadow" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{p.label}</span>
          </button>
        );
      })}
      <Link
        to="/auth"
        className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium text-white bg-slate-900 hover:bg-slate-800"
      >
        <LogIn className="w-4 h-4" />
        <span className="hidden sm:inline">Staff Login</span>
      </Link>
    </div>
  );
}

/* ---------------- CLIENTE ---------------- */
type CartItem = { id: number; name: string; price: number; qty: number };

const MENU = [
  { cat: "Lanches", icon: Pizza, items: [
    { id: 1, name: "Hambúrguer Artesanal", price: 32, desc: "Pão brioche, 180g, queijo cheddar" },
    { id: 2, name: "X-Bacon Duplo", price: 38, desc: "Dois discos, bacon crocante" },
    { id: 3, name: "Veggie Burger", price: 29, desc: "Hambúrguer de grão-de-bico" },
  ]},
  { cat: "Bebidas", icon: Coffee, items: [
    { id: 4, name: "Refrigerante Lata", price: 7, desc: "350ml" },
    { id: 5, name: "Suco Natural", price: 12, desc: "Laranja, abacaxi ou limão" },
    { id: 6, name: "Cerveja Long Neck", price: 14, desc: "Heineken 330ml" },
  ]},
];

function ClienteView() {
  const [step, setStep] = useState<"lead" | "menu" | "cart" | "split">("lead");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  // Conta total da mesa (simulação multi-cliente)
  const tableItems: CartItem[] = useMemo(() => [
    { id: 1, name: "Hambúrguer Artesanal", price: 32, qty: 1 },
    { id: 4, name: "Refrigerante Lata", price: 7, qty: 2 },
    { id: 2, name: "X-Bacon Duplo", price: 38, qty: 1 },
    { id: 6, name: "Cerveja Long Neck", price: 14, qty: 3 },
    ...cart,
  ], [cart]);

  return (
    <div className="max-w-md mx-auto px-4 pb-12">
      <PhoneFrame>
        {step === "lead" && (
          <LeadScreen name={name} phone={phone} setName={setName} setPhone={setPhone} onSubmit={() => setStep("menu")} />
        )}
        {step === "menu" && (
          <MenuScreen name={name} cart={cart} setCart={setCart} onCart={() => setStep("cart")} />
        )}
        {step === "cart" && (
          <CartScreen cart={cart} onBack={() => setStep("menu")} onSplit={() => setStep("split")} />
        )}
        {step === "split" && (
          <SplitScreen items={tableItems} customerName={name} onBack={() => setStep("cart")} />
        )}
      </PhoneFrame>
    </div>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden min-h-[640px]">
      {children}
    </div>
  );
}

function LeadScreen({ name, phone, setName, setPhone, onSubmit }: any) {
  return (
    <div className="p-6 flex flex-col items-center text-center">
      <div className="w-20 h-20 rounded-2xl bg-orange-100 flex items-center justify-center mb-4">
        <QrCode className="w-10 h-10 text-orange-600" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Bem-vindo!</h1>
      <p className="text-sm text-slate-500 mt-1">Mesa 04 • Comanda Fácil</p>
      <p className="text-slate-600 mt-4 text-sm">Para começar, conte pra gente quem é você 👋</p>
      <div className="w-full mt-6 space-y-3 text-left">
        <div>
          <label className="text-xs font-medium text-slate-600">Seu nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: João"
            className="mt-1 w-full px-3 py-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-orange-500" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">WhatsApp</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999"
            className="mt-1 w-full px-3 py-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-orange-500" />
        </div>
      </div>
      <button onClick={onSubmit} disabled={!name || !phone}
        className="mt-6 w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white font-semibold py-3 rounded-lg transition">
        Acessar Cardápio
      </button>
      <p className="text-xs text-slate-400 mt-4">Usaremos seu WhatsApp para enviar ofertas exclusivas.</p>
    </div>
  );
}

function MenuScreen({ name, cart, setCart, onCart }: any) {
  const add = (item: any) => {
    setCart((c: CartItem[]) => {
      const ex = c.find((x) => x.id === item.id);
      if (ex) return c.map((x) => x.id === item.id ? { ...x, qty: x.qty + 1 } : x);
      return [...c, { id: item.id, name: item.name, price: item.price, qty: 1 }];
    });
  };
  const total = cart.reduce((s: number, i: CartItem) => s + i.price * i.qty, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 bg-gradient-to-br from-orange-600 to-red-600 text-white">
        <p className="text-xs opacity-80">Mesa 04</p>
        <h1 className="text-xl font-bold">Olá, {name} 👋</h1>
        <div className="mt-3 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input placeholder="Buscar no cardápio..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/95 text-slate-900 text-sm focus:outline-none" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {MENU.map((sec) => (
          <div key={sec.cat}>
            <div className="flex items-center gap-2 mb-2">
              <sec.icon className="w-4 h-4 text-orange-600" />
              <h2 className="font-semibold text-slate-900">{sec.cat}</h2>
            </div>
            <div className="space-y-2">
              {sec.items.map((it) => (
                <div key={it.id} className="flex gap-3 p-3 rounded-xl border border-slate-200 hover:border-orange-300 transition">
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-amber-200 to-orange-300 flex items-center justify-center text-2xl">🍔</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-slate-900">{it.name}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2">{it.desc}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-bold text-orange-600">R$ {it.price.toFixed(2)}</span>
                      <button onClick={() => add(it)} className="bg-orange-600 hover:bg-orange-700 text-white w-7 h-7 rounded-full flex items-center justify-center">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {cart.length > 0 && (
        <button onClick={onCart} className="m-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl flex items-center justify-between px-5">
          <span className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            {cart.reduce((s: number, i: CartItem) => s + i.qty, 0)} itens
          </span>
          <span>R$ {total.toFixed(2)}</span>
        </button>
      )}
    </div>
  );
}

function CartScreen({ cart, onBack, onSplit }: any) {
  const total = cart.reduce((s: number, i: CartItem) => s + i.price * i.qty, 0);
  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-slate-200 flex items-center gap-3">
        <button onClick={onBack} className="p-1"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="font-bold text-slate-900">Minha Comanda</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {cart.map((it: CartItem) => (
          <div key={it.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
            <div>
              <p className="text-sm font-medium">{it.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Em preparo
                </span>
                <span className="text-xs text-slate-500">x{it.qty}</span>
              </div>
            </div>
            <span className="font-semibold text-sm">R$ {(it.price * it.qty).toFixed(2)}</span>
          </div>
        ))}
        {cart.length === 0 && <p className="text-center text-slate-400 text-sm mt-10">Sem itens ainda.</p>}
      </div>
      <div className="p-4 border-t border-slate-200 space-y-2">
        <div className="flex justify-between font-semibold">
          <span>Total individual</span><span>R$ {total.toFixed(2)}</span>
        </div>
        <button onClick={onSplit} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-xl">
          Pedir a Conta
        </button>
      </div>
    </div>
  );
}

function SplitScreen({ items, customerName, onBack }: { items: CartItem[]; customerName: string; onBack: () => void }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [sent, setSent] = useState(false);
  const toggle = (idx: number) => setSelected((s) => s.includes(idx) ? s.filter((x) => x !== idx) : [...s, idx]);
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const partial = selected.reduce((s, idx) => s + items[idx].price * items[idx].qty, 0);

  if (sent) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[600px]">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <Check className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-xl font-bold">Tudo certo, {customerName}!</h2>
        <p className="text-slate-600 mt-2 text-sm">O garçom aprovou seu pagamento parcial.</p>
        <p className="text-orange-600 font-semibold mt-4">Dirija-se ao caixa para finalizar.</p>
        <div className="mt-6 p-4 bg-slate-50 rounded-xl w-full">
          <p className="text-xs text-slate-500">Valor a pagar</p>
          <p className="text-3xl font-bold text-slate-900">R$ {partial.toFixed(2)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-slate-200 flex items-center gap-3">
        <button onClick={onBack} className="p-1"><ArrowLeft className="w-5 h-5" /></button>
        <div>
          <h1 className="font-bold text-slate-900">Dividir Conta</h1>
          <p className="text-xs text-slate-500">Mesa 04 • Total R$ {total.toFixed(2)}</p>
        </div>
      </div>
      <div className="px-4 py-3 bg-orange-50 text-xs text-orange-800">
        Selecione apenas os itens que <b>você consumiu</b>.
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {items.map((it, idx) => {
          const on = selected.includes(idx);
          return (
            <button key={idx} onClick={() => toggle(idx)}
              className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border-2 transition ${
                on ? "border-orange-600 bg-orange-50" : "border-slate-200"
              }`}>
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${on ? "bg-orange-600 border-orange-600" : "border-slate-300"}`}>
                {on && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{it.name}</p>
                <p className="text-xs text-slate-500">x{it.qty}</p>
              </div>
              <span className="font-semibold text-sm">R$ {(it.price * it.qty).toFixed(2)}</span>
            </button>
          );
        })}
      </div>
      <div className="p-4 border-t border-slate-200 space-y-3">
        <div className="flex justify-between">
          <span className="text-sm text-slate-600">Valor selecionado</span>
          <span className="text-xl font-bold text-orange-600">R$ {partial.toFixed(2)}</span>
        </div>
        <button onClick={() => setSent(true)} disabled={selected.length === 0}
          className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl">
          Enviar solicitação ao garçom
        </button>
        <p className="text-[11px] text-center text-slate-400">Dirija-se ao caixa após aprovação.</p>
      </div>
    </div>
  );
}

/* ---------------- COZINHA (KDS) ---------------- */
type Order = { id: string; table: number; client: string; items: string[]; time: number; status: "Recebido" | "Em Preparo" | "Finalizado" };

const INITIAL_ORDERS: Order[] = [
  { id: "#1042", table: 4, client: "João", items: ["1x Hambúrguer Artesanal", "1x Refrigerante"], time: 2, status: "Recebido" },
  { id: "#1043", table: 7, client: "Maria", items: ["2x X-Bacon Duplo", "1x Suco Natural"], time: 4, status: "Recebido" },
  { id: "#1041", table: 2, client: "Carlos", items: ["1x Veggie Burger"], time: 8, status: "Em Preparo" },
  { id: "#1040", table: 5, client: "Ana", items: ["3x Cerveja Long Neck", "1x Hambúrguer"], time: 12, status: "Em Preparo" },
  { id: "#1039", table: 1, client: "Lucas", items: ["1x X-Bacon"], time: 18, status: "Finalizado" },
];

function CozinhaView() {
  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const cols: Order["status"][] = ["Recebido", "Em Preparo", "Finalizado"];
  const advance = (id: string) => {
    setOrders((os) => os.map((o) => {
      if (o.id !== id) return o;
      const next = o.status === "Recebido" ? "Em Preparo" : o.status === "Em Preparo" ? "Finalizado" : "Finalizado";
      return { ...o, status: next as Order["status"] };
    }));
  };
  const colColors = {
    "Recebido": "border-blue-500",
    "Em Preparo": "border-amber-500",
    "Finalizado": "border-green-500",
  };

  return (
    <div className="min-h-screen bg-slate-900 -mt-20 pt-24 px-4 pb-8 text-slate-100">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><ChefHat className="w-6 h-6 text-orange-500" /> KDS — Monitor da Cozinha</h1>
            <p className="text-sm text-slate-400">{orders.filter((o) => o.status !== "Finalizado").length} pedidos ativos</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Tempo médio</p>
            <p className="text-xl font-bold text-orange-400">8 min</p>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {cols.map((col) => (
            <div key={col} className={`bg-slate-800 rounded-xl p-4 border-t-4 ${colColors[col]}`}>
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-semibold">{col}</h2>
                <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">
                  {orders.filter((o) => o.status === col).length}
                </span>
              </div>
              <div className="space-y-3">
                {orders.filter((o) => o.status === col).map((o) => (
                  <div key={o.id} className="bg-slate-700/60 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold">Mesa {o.table} • {o.client}</p>
                        <p className="text-xs text-slate-400">{o.id}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${o.time > 10 ? "bg-red-500/30 text-red-300" : "bg-slate-600 text-slate-300"}`}>
                        <Clock className="w-3 h-3" /> {o.time}min
                      </span>
                    </div>
                    <ul className="text-sm space-y-1 mb-3">
                      {o.items.map((it, i) => <li key={i} className="text-slate-200">• {it}</li>)}
                    </ul>
                    {o.status !== "Finalizado" && (
                      <button onClick={() => advance(o.id)} className="w-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium py-2 rounded-md">
                        {o.status === "Recebido" ? "Iniciar preparo" : "Marcar como pronto"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- GARÇOM ---------------- */
type TableState = { num: number; status: "Livre" | "Ocupada" | "Aguardando Pagamento"; total?: number; client?: string };
const TABLES: TableState[] = [
  { num: 1, status: "Ocupada", total: 84, client: "Lucas" },
  { num: 2, status: "Ocupada", total: 29, client: "Carlos" },
  { num: 3, status: "Livre" },
  { num: 4, status: "Aguardando Pagamento", total: 132, client: "João" },
  { num: 5, status: "Ocupada", total: 74, client: "Ana" },
  { num: 6, status: "Livre" },
  { num: 7, status: "Ocupada", total: 88, client: "Maria" },
  { num: 8, status: "Livre" },
];

function GarcomView() {
  const [tab, setTab] = useState<"mesas" | "notif">("notif");
  const [resolved, setResolved] = useState<string | null>(null);

  return (
    <div className="max-w-md mx-auto px-4 pb-12">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden min-h-[640px]">
        <div className="p-5 bg-slate-900 text-white">
          <h1 className="font-bold flex items-center gap-2"><UserCog className="w-5 h-5" /> Painel do Garçom</h1>
          <p className="text-xs text-slate-400 mt-1">Carlos • Salão Principal</p>
        </div>
        <div className="flex border-b border-slate-200">
          <button onClick={() => setTab("notif")} className={`flex-1 py-3 text-sm font-medium relative ${tab === "notif" ? "text-orange-600 border-b-2 border-orange-600" : "text-slate-500"}`}>
            <Bell className="w-4 h-4 inline mr-1" /> Notificações
            {!resolved && <span className="absolute top-2 right-6 w-2 h-2 bg-red-500 rounded-full" />}
          </button>
          <button onClick={() => setTab("mesas")} className={`flex-1 py-3 text-sm font-medium ${tab === "mesas" ? "text-orange-600 border-b-2 border-orange-600" : "text-slate-500"}`}>
            <TableIcon className="w-4 h-4 inline mr-1" /> Mesas
          </button>
        </div>

        {tab === "notif" && (
          <div className="p-4 space-y-3">
            {!resolved ? (
              <div className="border-2 border-orange-300 bg-orange-50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs text-orange-700 font-semibold uppercase mb-2">
                  <Bell className="w-3 h-3" /> Solicitação de pagamento parcial
                </div>
                <p className="text-slate-900 font-semibold">João • Mesa 04</p>
                <p className="text-sm text-slate-600 mt-1">Deseja pagar <b>R$ 45,00</b> referente a:</p>
                <ul className="text-sm text-slate-700 mt-2 ml-4 list-disc">
                  <li>1x Hambúrguer Artesanal</li>
                  <li>1x Refrigerante Lata</li>
                </ul>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setResolved("aprovado")} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-1">
                    <Check className="w-4 h-4" /> Aprovar
                  </button>
                  <button onClick={() => setResolved("rejeitado")} className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 py-2 rounded-lg font-semibold text-sm text-slate-700 flex items-center justify-center gap-1">
                    <X className="w-4 h-4" /> Rejeitar
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Check className="w-12 h-12 mx-auto text-green-500 mb-2" />
                <p className="text-sm">Pagamento {resolved} e enviado ao caixa.</p>
                <button onClick={() => setResolved(null)} className="mt-4 text-xs text-orange-600">Simular nova solicitação</button>
              </div>
            )}
          </div>
        )}

        {tab === "mesas" && (
          <div className="p-4 grid grid-cols-2 gap-3">
            {TABLES.map((t) => {
              const colors = {
                "Livre": "bg-green-50 border-green-300 text-green-700",
                "Ocupada": "bg-blue-50 border-blue-300 text-blue-700",
                "Aguardando Pagamento": "bg-orange-50 border-orange-300 text-orange-700",
              };
              return (
                <div key={t.num} className={`border-2 rounded-xl p-3 ${colors[t.status]}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg">Mesa {t.num}</span>
                    <TableIcon className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] uppercase font-semibold mt-1">{t.status}</p>
                  {t.client && <p className="text-xs text-slate-700 mt-1">{t.client}</p>}
                  {t.total && <p className="text-sm font-bold text-slate-900 mt-1">R$ {t.total.toFixed(2)}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- GESTOR ---------------- */
const NAV = [
  { id: "dash", label: "Dashboard", icon: LayoutDashboard },
  { id: "pdv", label: "PDV / Caixa", icon: ShoppingCart },
  { id: "kds", label: "Operação / KDS", icon: Monitor },
  { id: "menu", label: "Cardápio", icon: MenuSquare },
  { id: "crm", label: "Clientes (CRM)", icon: Users },
  { id: "fin", label: "Financeiro", icon: Wallet },
  { id: "cfg", label: "Configurações", icon: Settings },
];

function GestorView() {
  const [active, setActive] = useState("dash");
  return (
    <div className="flex max-w-7xl mx-auto px-4 gap-4 pb-12">
      <aside className="hidden md:block w-60 bg-white rounded-2xl border border-slate-200 p-3 h-fit sticky top-24">
        <div className="px-3 py-3 mb-2 border-b border-slate-100">
          <p className="font-bold text-slate-900">Comanda Fácil</p>
          <p className="text-xs text-slate-500">Lanchonete do Zé</p>
        </div>
        <nav className="space-y-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const a = active === n.id;
            return (
              <button key={n.id} onClick={() => setActive(n.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                  a ? "bg-orange-600 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}>
                <Icon className="w-4 h-4" /> {n.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="md:hidden flex gap-2 overflow-x-auto pb-3 mb-2">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setActive(n.id)} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium ${
              active === n.id ? "bg-orange-600 text-white" : "bg-white border border-slate-200 text-slate-600"
            }`}>{n.label}</button>
          ))}
        </div>
        {active === "dash" && <DashboardPanel />}
        {active !== "dash" && <PlaceholderPanel id={active} />}
      </main>
    </div>
  );
}

function DashboardPanel() {
  const metrics = [
    { label: "Vendas Hoje", value: "R$ 3.487", icon: DollarSign, color: "from-green-500 to-emerald-600", trend: "+18%" },
    { label: "Mesas Ocupadas", value: "5 / 8", icon: TableIcon, color: "from-blue-500 to-indigo-600", trend: "62%" },
    { label: "Ticket Médio", value: "R$ 68,40", icon: Receipt, color: "from-orange-500 to-red-600", trend: "+4%" },
    { label: "Pedidos Ativos", value: "12", icon: TrendingUp, color: "from-purple-500 to-pink-600", trend: "ao vivo" },
  ];
  const recent = [
    { id: "#1043", mesa: 7, client: "Maria", valor: 88, status: "Em Preparo" },
    { id: "#1042", mesa: 4, client: "João", valor: 132, status: "Aguardando Pgto" },
    { id: "#1041", mesa: 2, client: "Carlos", valor: 29, status: "Em Preparo" },
    { id: "#1040", mesa: 5, client: "Ana", valor: 74, status: "Em Preparo" },
    { id: "#1039", mesa: 1, client: "Lucas", valor: 84, status: "Finalizado" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Visão geral em tempo real</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="bg-white rounded-2xl p-4 border border-slate-200">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${m.color} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-xs text-slate-500">{m.label}</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{m.value}</p>
              <p className="text-xs text-green-600 font-medium mt-1">{m.trend}</p>
            </div>
          );
        })}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="font-semibold text-slate-900">Últimos Pedidos</h2>
          <button className="text-xs text-orange-600 flex items-center gap-1">Ver todos <ChevronRight className="w-3 h-3" /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-5 py-2">Pedido</th>
                <th className="text-left px-5 py-2">Mesa</th>
                <th className="text-left px-5 py-2">Cliente</th>
                <th className="text-left px-5 py-2">Valor</th>
                <th className="text-left px-5 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-5 py-3 font-mono text-xs">{r.id}</td>
                  <td className="px-5 py-3">{r.mesa}</td>
                  <td className="px-5 py-3">{r.client}</td>
                  <td className="px-5 py-3 font-semibold">R$ {r.valor.toFixed(2)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      r.status === "Finalizado" ? "bg-green-100 text-green-700" :
                      r.status === "Aguardando Pgto" ? "bg-orange-100 text-orange-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PlaceholderPanel({ id }: { id: string }) {
  const labels: Record<string, string> = {
    pdv: "PDV / Frente de Caixa", kds: "Operação / KDS", menu: "Catálogo & Cardápio",
    crm: "Clientes (CRM)", fin: "Financeiro", cfg: "Configurações",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
      <Utensils className="w-12 h-12 text-orange-500 mx-auto mb-3" />
      <h2 className="text-xl font-bold text-slate-900">{labels[id]}</h2>
      <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
        Módulo previsto na arquitetura. Pronto para integração com Supabase (tabelas relacionais)
        e disparos via n8n / webhooks.
      </p>
    </div>
  );
}

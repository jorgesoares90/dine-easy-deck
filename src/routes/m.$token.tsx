import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import {
  Utensils, Plus, Minus, ShoppingCart, Loader2, Check, ArrowLeft, MessageCircle,
} from "lucide-react";

export const Route = createFileRoute("/m/$token")({
  head: () => ({
    meta: [
      { title: "Cardápio Digital — Comanda" },
      { name: "description", content: "Faça seu pedido direto pela mesa." },
    ],
  }),
  component: ClientMenu,
});

type Tenant = { id: string; name: string; logo_url: string | null };
type RestaurantTable = { id: string; number: number; tenant_id: string };
type Category = { id: string; name: string; position: number };
type Product = { id: string; name: string; description: string | null; price: number; category_id: string | null; is_active: boolean };
type Session = { id: string; table_id: string; tenant_id: string };
type CartItem = { product: Product; qty: number };

const customerSchema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome").max(100),
  whatsapp: z.string().trim().min(8, "WhatsApp inválido").max(20),
});

function ClientMenu() {
  const { token } = Route.useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [table, setTable] = useState<RestaurantTable | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const [step, setStep] = useState<"lead" | "menu" | "sent">("lead");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // Bootstrap: load table by token, find/open session, load menu
  useEffect(() => {
    (async () => {
      try {
        const { data: t, error: tErr } = await supabase
          .from("restaurant_tables")
          .select("id, number, tenant_id")
          .eq("qr_token", token)
          .maybeSingle();
        if (tErr) throw tErr;
        if (!t) throw new Error("Mesa não encontrada. Verifique o QR Code.");
        setTable(t as any);

        const [{ data: ten }, { data: cats }, { data: prods }] = await Promise.all([
          supabase.from("tenants").select("id, name, logo_url").eq("id", (t as any).tenant_id).maybeSingle(),
          supabase.from("categories").select("*").eq("tenant_id", (t as any).tenant_id).eq("is_active", true).order("position"),
          supabase.from("products").select("*").eq("tenant_id", (t as any).tenant_id).eq("is_active", true).order("position"),
        ]);
        setTenant(ten as any);
        setCategories((cats as any) ?? []);
        setProducts((prods as any) ?? []);
        if (cats && cats.length) setActiveCat((cats[0] as any).id);

        // find an open session for this table
        const { data: openSess } = await supabase
          .from("table_sessions")
          .select("*")
          .eq("table_id", (t as any).id)
          .is("closed_at", null)
          .order("opened_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (openSess) {
          setSession(openSess as any);
          const stored = localStorage.getItem(`cf:customer:${(openSess as any).id}`);
          if (stored) setStep("menu");
        }
      } catch (e: any) {
        setError(e.message ?? "Erro ao carregar mesa.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = customerSchema.safeParse({ full_name: fullName, whatsapp });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    if (!table) return;
    let sess = session;
    if (!sess) {
      const { data, error } = await supabase
        .from("table_sessions")
        .insert({ tenant_id: table.tenant_id, table_id: table.id })
        .select()
        .single();
      if (error) { setFormError(error.message); return; }
      sess = data as any;
      setSession(sess);
      // mark table as occupied
      await supabase.from("restaurant_tables").update({ status: "ocupada" }).eq("id", table.id);
    }
    const { error: cErr } = await supabase.from("session_customers").insert({
      tenant_id: table.tenant_id,
      session_id: sess!.id,
      full_name: parsed.data.full_name,
      whatsapp: parsed.data.whatsapp,
    });
    if (cErr) { setFormError(cErr.message); return; }
    localStorage.setItem(`cf:customer:${sess!.id}`, JSON.stringify(parsed.data));
    setStep("menu");
  }

  function addToCart(p: Product) {
    setCart(prev => {
      const i = prev.findIndex(x => x.product.id === p.id);
      if (i >= 0) {
        const copy = [...prev]; copy[i] = { ...copy[i], qty: copy[i].qty + 1 }; return copy;
      }
      return [...prev, { product: p, qty: 1 }];
    });
  }
  function decFromCart(p: Product) {
    setCart(prev => prev
      .map(x => x.product.id === p.id ? { ...x, qty: x.qty - 1 } : x)
      .filter(x => x.qty > 0));
  }
  const total = useMemo(() => cart.reduce((s, x) => s + x.qty * Number(x.product.price), 0), [cart]);
  const itemCount = cart.reduce((s, x) => s + x.qty, 0);

  async function sendOrder() {
    if (!session || cart.length === 0) return;
    setSending(true);
    const { data: order, error } = await supabase.from("orders").insert({
      tenant_id: session.tenant_id,
      session_id: session.id,
      total,
      status: "enviado",
    }).select().single();
    if (error || !order) { alert(error?.message ?? "Erro"); setSending(false); return; }
    const items = cart.map(c => ({
      tenant_id: session.tenant_id,
      order_id: (order as any).id,
      product_id: c.product.id,
      product_name: c.product.name,
      unit_price: c.product.price,
      quantity: c.qty,
      status: "recebido" as const,
    }));
    const { error: iErr } = await supabase.from("order_items").insert(items);
    if (iErr) { alert(iErr.message); setSending(false); return; }
    setCart([]);
    setCartOpen(false);
    setSending(false);
    setStep("sent");
    setTimeout(() => setStep("menu"), 2500);
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-app"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>;
  }
  if (error || !table || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app p-6">
        <div className="max-w-sm w-full bg-white border border-line rounded-2xl p-6 text-center">
          <h1 className="text-lg font-bold mb-1">Não foi possível abrir</h1>
          <p className="text-sm text-ink-muted">{error ?? "Mesa inválida."}</p>
        </div>
      </div>
    );
  }

  // Lead capture
  if (step === "lead") {
    return (
      <div className="min-h-screen bg-app flex flex-col">
        <div className="bg-brand text-white px-5 py-8 rounded-b-3xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
              <Utensils className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm opacity-90">Bem-vindo a</div>
              <h1 className="font-bold text-2xl leading-tight">{tenant.name}</h1>
              <div className="text-xs opacity-80">Mesa {table.number}</div>
            </div>
          </div>
        </div>
        <form onSubmit={submitLead} className="flex-1 p-5 max-w-md w-full mx-auto">
          <h2 className="font-bold text-lg mb-1">Antes de pedir…</h2>
          <p className="text-sm text-ink-muted mb-5">Precisamos do seu nome e WhatsApp para abrir sua comanda.</p>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-ink-muted">Nome completo</span>
              <input value={fullName} onChange={e => setFullName(e.target.value)} maxLength={100} required
                className="mt-1 w-full px-3 py-2.5 border border-line rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand/40" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink-muted">WhatsApp</span>
              <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} maxLength={20} required
                placeholder="(11) 99999-9999"
                className="mt-1 w-full px-3 py-2.5 border border-line rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand/40" />
            </label>
            {formError && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">{formError}</div>}
            <button type="submit" className="w-full bg-brand text-white font-semibold py-3 rounded-xl hover:bg-brand-dark">
              Abrir minha comanda
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-brand text-white px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs opacity-80">Mesa {table.number}</div>
            <div className="font-bold text-lg leading-tight">{tenant.name}</div>
          </div>
          {step === "sent" && (
            <span className="bg-white/15 text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <Check className="w-3 h-3" /> Pedido enviado
            </span>
          )}
        </div>
        {/* Category tabs */}
        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar -mx-4 px-4">
          {categories.map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${
                activeCat === c.id ? "bg-white text-brand-dark" : "bg-white/15 text-white"
              }`}>
              {c.name}
            </button>
          ))}
        </div>
      </header>

      {/* Menu */}
      <main className="p-4 max-w-md mx-auto">
        {categories.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl p-8 text-center text-ink-muted text-sm">
            Cardápio sendo preparado.
          </div>
        ) : (
          <ul className="space-y-3">
            {products.filter(p => p.category_id === activeCat).map(p => {
              const inCart = cart.find(x => x.product.id === p.id);
              return (
                <li key={p.id} className="bg-white border border-line rounded-2xl p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink">{p.name}</div>
                    {p.description && <div className="text-xs text-ink-muted mt-0.5">{p.description}</div>}
                    <div className="font-bold text-brand mt-2">R$ {Number(p.price).toFixed(2)}</div>
                  </div>
                  {inCart ? (
                    <div className="flex items-center gap-2 bg-brand-soft rounded-full p-1">
                      <button onClick={() => decFromCart(p)} className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-brand">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-5 text-center font-bold text-brand-dark">{inCart.qty}</span>
                      <button onClick={() => addToCart(p)} className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => addToCart(p)} className="w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center hover:bg-brand-dark">
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </li>
              );
            })}
            {products.filter(p => p.category_id === activeCat).length === 0 && (
              <li className="text-center text-sm text-ink-muted py-8">Sem itens nesta categoria.</li>
            )}
          </ul>
        )}
      </main>

      {/* Cart bar */}
      {itemCount > 0 && (
        <button onClick={() => setCartOpen(true)}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[90%] max-w-md bg-ink text-white rounded-full px-5 py-3.5 flex items-center justify-between shadow-xl">
          <span className="flex items-center gap-2 font-semibold">
            <ShoppingCart className="w-4 h-4" /> {itemCount} {itemCount === 1 ? "item" : "itens"}
          </span>
          <span className="font-bold">R$ {total.toFixed(2)}</span>
        </button>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 bg-ink/40 flex items-end" onClick={() => setCartOpen(false)}>
          <div className="bg-white w-full rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setCartOpen(false)} className="p-1 text-ink-muted"><ArrowLeft className="w-5 h-5" /></button>
              <h3 className="font-bold">Seu pedido</h3>
              <span className="w-7" />
            </div>
            <ul className="divide-y divide-line">
              {cart.map(c => (
                <li key={c.product.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{c.product.name}</div>
                    <div className="text-xs text-ink-muted">R$ {Number(c.product.price).toFixed(2)}</div>
                  </div>
                  <div className="flex items-center gap-2 bg-cream rounded-full p-1">
                    <button onClick={() => decFromCart(c.product)} className="w-7 h-7 rounded-full bg-white flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="w-5 text-center font-bold">{c.qty}</span>
                    <button onClick={() => addToCart(c.product)} className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t border-line flex items-center justify-between text-lg font-bold">
              <span>Total</span><span>R$ {total.toFixed(2)}</span>
            </div>
            <button onClick={sendOrder} disabled={sending}
              className="mt-4 w-full bg-brand text-white font-semibold py-3 rounded-xl hover:bg-brand-dark disabled:opacity-60 flex items-center justify-center gap-2">
              {sending && <Loader2 className="w-4 h-4 animate-spin" />}
              <MessageCircle className="w-4 h-4" /> Enviar para a cozinha
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

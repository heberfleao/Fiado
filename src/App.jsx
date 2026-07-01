import React, { useState, useEffect, useCallback } from "react";
import {
  Store, User, Lock, Plus, Search, LogOut, Receipt, AlertCircle,
  ArrowLeft, ShoppingBag, Stamp, X, Phone, CreditCard, Mail, ShieldCheck,
} from "lucide-react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  doc, getDoc, setDoc, addDoc, updateDoc, collection, query, where, getDocs, serverTimestamp,
} from "firebase/firestore";
import { auth, db, secondaryAuth } from "./firebase";
import {
  onlyDigits, formatCPF, formatPhone, isValidCPF, brl, fmtDate, todayISO, addDaysISO,
  cpfToEmail, saleDisplayStatus,
} from "./helpers";
import PinPad from "./PinPad";

function StampBadge({ kind }) {
  const map = {
    CONFIRMADO: { color: "#2F5233", label: "CONFIRMADO" },
    PAGO: { color: "#3F6B8A", label: "PAGO" },
    VENCIDO: { color: "#A63D40", label: "VENCIDO" },
  };
  const s = map[kind] || map.CONFIRMADO;
  return (
    <span className="stamp" style={{ color: s.color, borderColor: s.color }}>
      {s.label}
    </span>
  );
}

export default function App() {
  const [screen, setScreen] = useState("loading"); // loading, adminSetup, adminLogin, admin
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [storeExists, setStoreExists] = useState(null);
  const [adminUid, setAdminUid] = useState(null);

  const showToast = (msg, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3200);
  };

  // ---------- ADMIN SETUP / LOGIN ----------
  const [setupEmail, setSetupEmail] = useState("");
  const [setupStoreName, setSetupStoreName] = useState("");
  const [setupPass, setSetupPass] = useState("");
  const [setupPass2, setSetupPass2] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassAdmin, setLoginPassAdmin] = useState("");

  // ---------- dashboard ----------
  const [customersIndex, setCustomersIndex] = useState([]);
  const [adminTab, setAdminTab] = useState("clientes");
  const [customerSearch, setCustomerSearch] = useState("");
  const [detailCustomerId, setDetailCustomerId] = useState(null);
  const [detailSales, setDetailSales] = useState(null);

  // ---------- new customer modal ----------
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [custStep, setCustStep] = useState("info"); // info, pin1, pin2
  const [newCust, setNewCust] = useState({ name: "", cpf: "", phone: "" });
  const [firstPin, setFirstPin] = useState(null);
  const [custPinError, setCustPinError] = useState("");
  const [custPinResetKey, setCustPinResetKey] = useState(0);

  // ---------- new sale flow ----------
  const [saleStep, setSaleStep] = useState("form"); // form, pin
  const [saleCustomerId, setSaleCustomerId] = useState("");
  const [saleValue, setSaleValue] = useState("");
  const [saleDesc, setSaleDesc] = useState("");
  const [saleDue, setSaleDue] = useState(addDaysISO(30));
  const [salePinError, setSalePinError] = useState("");
  const [salePinResetKey, setSalePinResetKey] = useState(0);
  const [salePinBusy, setSalePinBusy] = useState(false);

  // ---------- bootstrap ----------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      const storeSnap = await getDoc(doc(db, "config", "store"));
      const exists = storeSnap.exists();
      setStoreExists(exists);
      const currentAdminUid = exists ? storeSnap.data().adminUid : null;
      setAdminUid(currentAdminUid);

      if (user && exists && user.uid === currentAdminUid) {
        await loadCustomersIndex(currentAdminUid);
        setScreen("admin");
        return;
      }
      if (user) {
        // Signed in but not the recognized admin — shouldn't normally happen.
        await signOut(auth);
      }
      setScreen(exists ? "adminLogin" : "adminSetup");
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCustomersIndex = useCallback(async (ownerUid) => {
    const q = query(collection(db, "customers"), where("adminUid", "==", ownerUid));
    const snap = await getDocs(q);
    const idx = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    idx.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    setCustomersIndex(idx);
    return idx;
  }, []);

  const loadSalesFor = async (custUid) => {
    const q = query(collection(db, "sales"), where("customerUid", "==", custUid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  };

  // ---------- ADMIN SETUP ----------
  const submitAdminSetup = async () => {
    if (!setupEmail.includes("@")) return showToast("Digite um e-mail válido", true);
    if (!setupStoreName.trim()) return showToast("Informe o nome do mercado", true);
    if (setupPass.length < 6) return showToast("A senha precisa ter ao menos 6 caracteres", true);
    if (setupPass !== setupPass2) return showToast("As senhas não coincidem", true);
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, setupEmail.trim(), setupPass);
      await setDoc(doc(db, "config", "store"), {
        adminUid: cred.user.uid,
        storeName: setupStoreName.trim(),
        email: setupEmail.trim(),
        createdAt: Date.now(),
      });
      setStoreExists(true);
      setAdminUid(cred.user.uid);
      await loadCustomersIndex(cred.user.uid);
      showToast("Conta do mercado criada!");
      setScreen("admin");
    } catch (e) {
      showToast(mapAuthError(e), true);
    }
    setBusy(false);
  };

  const submitAdminLogin = async () => {
    if (!loginEmail.includes("@") || !loginPassAdmin) return showToast("Preencha e-mail e senha", true);
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassAdmin);
      setLoginPassAdmin("");
    } catch (e) {
      showToast(mapAuthError(e), true);
    }
    setBusy(false);
  };

  const resetAdminPassword = async () => {
    if (!loginEmail.includes("@")) return showToast("Digite seu e-mail para receber o link", true);
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, loginEmail.trim());
      showToast("Link de redefinição enviado para o e-mail.");
    } catch (e) {
      showToast(mapAuthError(e), true);
    }
    setBusy(false);
  };

  const logout = async () => {
    await signOut(auth);
    setDetailCustomerId(null);
    setDetailSales(null);
    setAdminTab("clientes");
  };

  // ---------- NEW CUSTOMER (2-step PIN set) ----------
  const openNewCustomer = () => {
    setNewCust({ name: "", cpf: "", phone: "" });
    setFirstPin(null);
    setCustPinError("");
    setCustStep("info");
    setShowNewCustomer(true);
  };

  const goToSetPin = () => {
    if (!newCust.name.trim()) return showToast("Informe o nome do cliente", true);
    const cpfDigits = onlyDigits(newCust.cpf);
    if (!isValidCPF(cpfDigits)) return showToast("CPF inválido", true);
    setCustStep("pin1");
  };

  const onFirstPinComplete = (pin) => {
    setFirstPin(pin);
    setCustPinError("");
    setCustStep("pin2");
  };

  const onConfirmPinComplete = async (pin) => {
    if (pin !== firstPin) {
      setCustPinError("As senhas não conferem. Vamos tentar de novo.");
      setFirstPin(null);
      setCustPinResetKey((k) => k + 1);
      setCustStep("pin1");
      return;
    }
    await createCustomer(pin);
  };

  const createCustomer = async (pin) => {
    const { name, phone } = newCust;
    const cpfDigits = onlyDigits(newCust.cpf);
    setBusy(true);
    try {
      const dupCheck = await getDocs(query(collection(db, "customers"), where("adminUid", "==", adminUid), where("cpf", "==", cpfDigits)));
      if (!dupCheck.empty) {
        showToast("Já existe um cliente com esse CPF", true);
        setBusy(false);
        setShowNewCustomer(false);
        return;
      }
      const email = cpfToEmail(cpfDigits);
      // Cria a conta de autenticação (guarda a senha do cliente com segurança)
      // usando o app secundário, para não trocar a sessão do mercado.
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, pin);
      const uid = cred.user.uid;
      await signOut(secondaryAuth);

      const custData = { name: name.trim(), cpf: cpfDigits, phone: onlyDigits(phone), email, adminUid, createdAt: Date.now() };
      await setDoc(doc(db, "customers", uid), custData);

      setCustomersIndex((prev) => [...prev, { id: uid, ...custData }].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      setShowNewCustomer(false);
      showToast("Cliente cadastrado!");
    } catch (e) {
      showToast(mapAuthError(e), true);
    }
    setBusy(false);
  };

  // ---------- SALE + PIN CONFIRMATION ----------
  const goToSalePin = () => {
    if (!saleCustomerId) return showToast("Selecione um cliente", true);
    const val = parseFloat(saleValue.replace(",", "."));
    if (!val || val <= 0) return showToast("Informe um valor válido", true);
    setSalePinError("");
    setSaleStep("pin");
  };

  const cancelSalePin = () => {
    setSaleStep("form");
    setSalePinError("");
  };

  const onSalePinComplete = async (pin) => {
    const customer = customersIndex.find((c) => c.id === saleCustomerId);
    if (!customer) return;
    setSalePinBusy(true);
    setSalePinError("");
    try {
      await signInWithEmailAndPassword(secondaryAuth, customer.email, pin);
      await signOut(secondaryAuth);

      const val = parseFloat(saleValue.replace(",", "."));
      await addDoc(collection(db, "sales"), {
        customerUid: saleCustomerId,
        value: val,
        description: saleDesc.trim(),
        date: todayISO(),
        dueDate: saleDue,
        status: "confirmed",
        confirmedAt: serverTimestamp(),
        createdBy: adminUid,
        createdAt: serverTimestamp(),
      });

      showToast(`Compra de ${brl(val)} confirmada e lançada para ${customer.name}.`);
      setSaleValue("");
      setSaleDesc("");
      setSaleDue(addDaysISO(30));
      setSaleCustomerId("");
      setSaleStep("form");
    } catch (e) {
      setSalePinError("Senha incorreta. Peça para o cliente tentar novamente.");
      setSalePinResetKey((k) => k + 1);
    }
    setSalePinBusy(false);
  };

  // ---------- customer detail ----------
  const openDetail = async (custId) => {
    setDetailCustomerId(custId);
    setDetailSales(null);
    const sales = await loadSalesFor(custId);
    setDetailSales(sales.sort((a, b) => (a.date < b.date ? 1 : -1)));
  };

  const markSalePaid = async (saleId) => {
    setBusy(true);
    await updateDoc(doc(db, "sales", saleId), { status: "paid" });
    const sales = await loadSalesFor(detailCustomerId);
    setDetailSales(sales.sort((a, b) => (a.date < b.date ? 1 : -1)));
    setBusy(false);
    showToast("Venda marcada como paga.");
  };

  const markAllPaid = async () => {
    setBusy(true);
    const sales = await loadSalesFor(detailCustomerId);
    await Promise.all(
      sales.filter((s) => s.status === "confirmed").map((s) => updateDoc(doc(db, "sales", s.id), { status: "paid" }))
    );
    const updated = await loadSalesFor(detailCustomerId);
    setDetailSales(updated.sort((a, b) => (a.date < b.date ? 1 : -1)));
    setBusy(false);
    showToast("Fatura quitada!");
  };

  // ---------- derived ----------
  const filteredCustomers = customersIndex.filter((c) => {
    const q = customerSearch.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.cpf.includes(onlyDigits(customerSearch));
  });

  const detailCustomer = detailCustomerId ? customersIndex.find((c) => c.id === detailCustomerId) : null;
  const detailOwed = (detailSales || []).filter((s) => s.status === "confirmed").reduce((a, s) => a + s.value, 0);

  const saleCustomer = customersIndex.find((c) => c.id === saleCustomerId);
  const saleVal = parseFloat((saleValue || "0").replace(",", ".")) || 0;

  if (screen === "loading") {
    return <div className="wrap"><div className="shell"><div className="center-screen">Carregando...</div></div></div>;
  }

  return (
    <div className="wrap">
      <div className="shell">
        <div className="topbar">
          <div className="brand">
            <Store size={22} />
            <div>
              <div className="brand-title">Caderneta Digital</div>
              <div className="brand-sub">controle de fiado</div>
            </div>
          </div>
          {screen === "admin" && (
            <button className="icon-btn" onClick={logout}><LogOut size={18} /></button>
          )}
        </div>

        <div className="content">
          {screen === "adminSetup" && (
            <div className="center-screen">
              <Lock size={28} color="#2F5233" />
              <div className="ledger-title">Bem-vindo</div>
              <div className="ledger-tag">Crie a conta de acesso do mercado</div>
              <div style={{ width: "100%" }}>
                <label className="field-label">Nome do mercado</label>
                <input className="field" value={setupStoreName} onChange={(e) => setSetupStoreName(e.target.value)} />
                <label className="field-label">Seu e-mail</label>
                <input className="field" type="email" value={setupEmail} onChange={(e) => setSetupEmail(e.target.value)} />
                <label className="field-label">Nova senha (mín. 6 caracteres)</label>
                <input className="field" type="password" value={setupPass} onChange={(e) => setSetupPass(e.target.value)} />
                <label className="field-label">Confirme a senha</label>
                <input className="field" type="password" value={setupPass2} onChange={(e) => setSetupPass2(e.target.value)} />
                <button className="btn btn-primary" onClick={submitAdminSetup} disabled={busy}>Criar conta do mercado</button>
              </div>
            </div>
          )}

          {screen === "adminLogin" && (
            <div className="center-screen">
              <Store size={28} color="#2F5233" />
              <div className="ledger-title">Entrar</div>
              <div className="ledger-tag">Digite seu e-mail e senha</div>
              <div style={{ width: "100%" }}>
                <label className="field-label">E-mail</label>
                <input className="field" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} autoFocus />
                <label className="field-label">Senha</label>
                <input className="field" type="password" value={loginPassAdmin}
                  onChange={(e) => setLoginPassAdmin(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitAdminLogin()} />
                <button className="btn btn-primary" onClick={submitAdminLogin} disabled={busy}>Entrar</button>
                <button className="link-btn" onClick={resetAdminPassword}><Mail size={13} style={{ display: "inline", marginRight: 4 }} />Esqueci minha senha</button>
              </div>
            </div>
          )}

          {screen === "admin" && !detailCustomerId && (
            <>
              {adminTab === "clientes" && (
                <>
                  <div className="section-title"><User size={16} /> Clientes</div>
                  <div className="search-row">
                    <Search size={16} color="#8C8362" />
                    <input placeholder="Buscar por nome ou CPF" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
                  </div>
                  <button className="btn btn-accent" style={{ marginBottom: 16 }} onClick={openNewCustomer}>
                    <Plus size={17} /> Novo cliente
                  </button>
                  {filteredCustomers.length === 0 && (
                    <div className="empty"><User size={30} /><div>Nenhum cliente cadastrado ainda.</div></div>
                  )}
                  {filteredCustomers.map((c) => (
                    <div className="cust-row" key={c.id} onClick={() => openDetail(c.id)}>
                      <div>
                        <div className="cust-name">{c.name}</div>
                        <div className="cust-cpf">{formatCPF(c.cpf)}</div>
                      </div>
                      <ArrowLeft size={16} style={{ transform: "rotate(180deg)", color: "#8C8362" }} />
                    </div>
                  ))}
                </>
              )}

              {adminTab === "venda" && saleStep === "form" && (
                <>
                  <div className="section-title"><ShoppingBag size={16} /> Lançar venda no fiado</div>
                  <label className="field-label">Cliente</label>
                  <select className="field" value={saleCustomerId} onChange={(e) => setSaleCustomerId(e.target.value)}>
                    <option value="">Selecione o cliente...</option>
                    {customersIndex.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} — {formatCPF(c.cpf)}</option>
                    ))}
                  </select>
                  <label className="field-label">Valor da compra</label>
                  <input className="field field-mono" placeholder="0,00" inputMode="decimal" value={saleValue} onChange={(e) => setSaleValue(e.target.value)} />
                  <label className="field-label">Descrição (opcional)</label>
                  <input className="field" placeholder="Ex: compras do mês" value={saleDesc} onChange={(e) => setSaleDesc(e.target.value)} />
                  <label className="field-label">Vencimento</label>
                  <input className="field" type="date" value={saleDue} onChange={(e) => setSaleDue(e.target.value)} />
                  <button className="btn btn-primary" onClick={goToSalePin}>
                    <Stamp size={17} /> Lançar venda
                  </button>
                  <div className="warn-banner" style={{ marginTop: 14 }}>
                    <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                    Em seguida, entregue o aparelho para o cliente digitar a senha dele e confirmar.
                  </div>
                </>
              )}

              {adminTab === "venda" && saleStep === "pin" && (
                <div className="center-screen" style={{ paddingTop: 10 }}>
                  <ShieldCheck size={26} color="#2F5233" />
                  <div className="pin-customer-name">{saleCustomer?.name}</div>
                  <div className="pin-customer-value">{brl(saleVal)}</div>
                  <div className="pin-hint">Entregue o aparelho para o cliente digitar a senha e confirmar a compra</div>
                  <PinPad resetKey={salePinResetKey} busy={salePinBusy} onComplete={onSalePinComplete} />
                  <div className="pin-error">{salePinError}</div>
                  <button className="link-btn" style={{ marginTop: 14 }} onClick={cancelSalePin} disabled={salePinBusy}>Cancelar</button>
                </div>
              )}

              {adminTab === "cobrancas" && (
                <CobrancasTab customersIndex={customersIndex} openDetail={openDetail} loadSalesFor={loadSalesFor} />
              )}
            </>
          )}

          {screen === "admin" && detailCustomerId && detailCustomer && (
            <>
              <div className="back-row" onClick={() => { setDetailCustomerId(null); setDetailSales(null); }}>
                <ArrowLeft size={16} /> Voltar
              </div>
              <div className="card">
                <div className="cust-name" style={{ fontSize: 17 }}>{detailCustomer.name}</div>
                <div className="cust-cpf" style={{ marginTop: 4 }}>
                  <CreditCard size={12} style={{ display: "inline", marginRight: 4 }} />
                  {formatCPF(detailCustomer.cpf)}
                </div>
                {detailCustomer.phone && (
                  <div className="cust-cpf" style={{ marginTop: 3 }}>
                    <Phone size={12} style={{ display: "inline", marginRight: 4 }} />
                    {formatPhone(detailCustomer.phone)}
                  </div>
                )}
              </div>

              <div className="card">
                <div className="row-between">
                  <div>
                    <div className="field-label" style={{ marginBottom: 2 }}>Saldo devedor</div>
                    <div className={"owed-amt " + (detailOwed > 0 ? "pos" : "zero")} style={{ fontSize: 20 }}>{brl(detailOwed)}</div>
                  </div>
                  {detailOwed > 0 && (
                    <button className="btn btn-primary btn-sm" onClick={markAllPaid} disabled={busy}>Marcar tudo pago</button>
                  )}
                </div>
              </div>

              <div className="section-title" style={{ marginTop: 4 }}><Receipt size={16} /> Histórico</div>
              {detailSales === null && <div className="empty">Carregando...</div>}
              {detailSales && detailSales.length === 0 && (
                <div className="empty"><Receipt size={30} /><div>Nenhuma venda lançada ainda.</div></div>
              )}
              {detailSales && detailSales.length > 0 && (
                <div className="card">
                  {detailSales.map((s) => (
                    <div className="sale-item" key={s.id}>
                      <div className="sale-top">
                        <div>
                          <div className="sale-val">{brl(s.value)}</div>
                          {s.description && <div className="sale-desc">{s.description}</div>}
                          <div className="sale-meta">
                            <span>Venda: {fmtDate(s.date)}</span>
                            <span>Vence: {fmtDate(s.dueDate)}</span>
                          </div>
                        </div>
                        <StampBadge kind={saleDisplayStatus(s)} />
                      </div>
                      {s.status === "confirmed" && (
                        <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={() => markSalePaid(s.id)} disabled={busy}>
                          Marcar como pago
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {screen === "admin" && !detailCustomerId && (
          <div className="tabs">
            <div className="tabs-inner">
              <button className={"tab-btn" + (adminTab === "clientes" ? " active" : "")} onClick={() => { setAdminTab("clientes"); setSaleStep("form"); }}>
                <User size={19} /> Clientes
              </button>
              <button className={"tab-btn" + (adminTab === "venda" ? " active" : "")} onClick={() => setAdminTab("venda")}>
                <ShoppingBag size={19} /> Nova venda
              </button>
              <button className={"tab-btn" + (adminTab === "cobrancas" ? " active" : "")} onClick={() => { setAdminTab("cobrancas"); setSaleStep("form"); }}>
                <Receipt size={19} /> Cobranças
              </button>
            </div>
          </div>
        )}

        {/* NEW CUSTOMER MODAL */}
        {showNewCustomer && (
          <div className="modal-overlay" onClick={() => !busy && setShowNewCustomer(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              {custStep === "info" && (
                <>
                  <div className="row-between" style={{ marginBottom: 14 }}>
                    <div className="section-title" style={{ margin: 0 }}>Novo cliente</div>
                    <button className="icon-btn" style={{ borderColor: "#B9AE8F", color: "#23301F" }} onClick={() => setShowNewCustomer(false)}><X size={16} /></button>
                  </div>
                  <label className="field-label">Nome completo</label>
                  <input className="field" value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} />
                  <label className="field-label">CPF</label>
                  <input className="field field-mono" placeholder="000.000.000-00" value={formatCPF(newCust.cpf)}
                    onChange={(e) => setNewCust({ ...newCust, cpf: e.target.value })} inputMode="numeric" />
                  <label className="field-label">Telefone</label>
                  <input className="field field-mono" placeholder="(00) 00000-0000" value={formatPhone(newCust.phone)}
                    onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} inputMode="numeric" />
                  <button className="btn btn-primary" onClick={goToSetPin}>Continuar</button>
                </>
              )}

              {custStep === "pin1" && (
                <div style={{ textAlign: "center" }}>
                  <div className="section-title" style={{ justifyContent: "center" }}>Senha do cliente</div>
                  <div className="pin-hint">Peça para {newCust.name.split(" ")[0] || "o cliente"} criar uma senha de 6 dígitos</div>
                  <PinPad resetKey={custPinResetKey} onComplete={onFirstPinComplete} />
                  <div className="pin-error">{custPinError}</div>
                  <button className="link-btn" onClick={() => setCustStep("info")}>Voltar</button>
                </div>
              )}

              {custStep === "pin2" && (
                <div style={{ textAlign: "center" }}>
                  <div className="section-title" style={{ justifyContent: "center" }}>Confirme a senha</div>
                  <div className="pin-hint">Digite a mesma senha novamente</div>
                  <PinPad busy={busy} onComplete={onConfirmPinComplete} />
                  <button className="link-btn" onClick={() => setCustStep("info")} disabled={busy}>Cancelar</button>
                </div>
              )}
            </div>
          </div>
        )}

        {toast && <div className={"toast" + (toast.err ? " err" : "")}>{toast.msg}</div>}
      </div>
    </div>
  );
}

function CobrancasTab({ customersIndex, openDetail, loadSalesFor }) {
  const [totals, setTotals] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = [];
      for (const c of customersIndex) {
        const sales = await loadSalesFor(c.id);
        const owed = sales.filter((s) => s.status === "confirmed").reduce((a, s) => a + s.value, 0);
        const overdue = sales.some((s) => s.status === "confirmed" && s.dueDate < todayISO());
        results.push({ ...c, owed, overdue });
      }
      if (!cancelled) {
        results.sort((a, b) => b.owed - a.owed);
        setTotals(results);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customersIndex]);

  const grandTotal = totals ? totals.reduce((a, c) => a + c.owed, 0) : 0;

  return (
    <>
      <div className="section-title"><Receipt size={16} /> Cobranças</div>
      <div className="card total-box" style={{ marginBottom: 18 }}>
        <div className="total-label">Total a receber</div>
        <div className="total-value">{brl(grandTotal)}</div>
      </div>
      {totals === null && <div className="empty">Carregando...</div>}
      {totals && totals.filter((c) => c.owed > 0).length === 0 && (
        <div className="empty"><Receipt size={30} /><div>Nenhuma cobrança em aberto.</div></div>
      )}
      {totals && totals.filter((c) => c.owed > 0).map((c) => (
        <div className="cust-row" key={c.id} onClick={() => openDetail(c.id)}>
          <div>
            <div className="cust-name">{c.name}</div>
            <div className="cust-cpf">{formatCPF(c.cpf)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="owed-amt pos">{brl(c.owed)}</div>
            {c.overdue && <StampBadge kind="VENCIDO" />}
          </div>
        </div>
      ))}
    </>
  );
}

function mapAuthError(e) {
  const code = e?.code || "";
  if (code.includes("email-already-in-use")) return "Já existe uma conta com esse e-mail.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found"))
    return "E-mail ou senha incorretos.";
  if (code.includes("weak-password")) return "Senha muito fraca (mínimo 6 caracteres).";
  if (code.includes("invalid-email")) return "E-mail inválido.";
  if (code.includes("too-many-requests")) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  return "Ocorreu um erro. Tente novamente.";
}

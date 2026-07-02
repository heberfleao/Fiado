export const onlyDigits = (s) => (s || "").replace(/\D/g, "");

export const formatCPF = (v) => {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

export const formatPhone = (v) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim().replace(/-$/, "");
  }
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim().replace(/-$/, "");
};

export const isValidCPF = (cpfRaw) => {
  const cpf = onlyDigits(cpfRaw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev >= 10) rev = 0;
  if (rev !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev >= 10) rev = 0;
  return rev === parseInt(cpf[10]);
};

export const brl = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);

export const fmtDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("pt-BR");
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const addDaysISO = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// E-mail sintético usado internamente para autenticar o cliente pelo CPF.
// O cliente nunca vê nem usa esse e-mail — ele só digita CPF e senha.
export const cpfToEmail = (cpfDigits) => `cliente.${cpfDigits}@caderneta.fiado`;

// Gera um novo e-mail sintético único, usado ao redefinir a senha do
// cliente (a conta antiga fica órfã e sem uso; o campo "email" salvo no
// cadastro do cliente passa a apontar para essa nova conta).
export const cpfToResetEmail = (cpfDigits) => `cliente.${cpfDigits}.${Date.now()}@caderneta.fiado`;

// O Firebase Auth exige senha com pelo menos 6 caracteres. Como a senha
// do cliente é um PIN de 4 dígitos (mais fácil de digitar no dia a dia),
// completamos com um sufixo fixo antes de enviar para o Firebase — o
// cliente nunca vê nem digita esse sufixo, só os 4 dígitos do PIN.
export const CUSTOMER_PIN_LENGTH = 4;
export const padPinForAuth = (pin) => `${pin}-pin`;

export function saleDisplayStatus(sale) {
  if (sale.status === "paid") return "PAGO";
  if (sale.dueDate && sale.dueDate < todayISO()) return "VENCIDO";
  return "CONFIRMADO";
}

// Clampa o dia dentro do número de dias válidos daquele mês (ex: dia 31 em
// fevereiro vira o último dia do mês).
const clampDay = (year, month, day) => {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.max(1, Math.min(day, lastDay));
};

// Calcula o vencimento de UMA COMPRA a partir do "dia de vencimento da
// fatura" do cliente. Regra: a fatura fecha 5 dias antes do vencimento.
// Compras feitas até o fechamento entram na fatura do mês atual; compras
// feitas depois do fechamento entram na fatura do mês seguinte.
export function computeSaleDueDate(dueDay, fromDate = new Date()) {
  const day = parseInt(dueDay, 10) || 10;
  const y = fromDate.getFullYear();
  const m = fromDate.getMonth();
  // new Date() normaliza dias negativos/estourados automaticamente,
  // então "dia - 5" pode virar o mês anterior sem problema.
  const closingDate = new Date(y, m, day - 5);
  const todayStart = new Date(y, fromDate.getMonth(), fromDate.getDate());

  let targetYear = y;
  let targetMonth = m;
  if (todayStart > closingDate) {
    targetMonth = m + 1;
  }
  const dueDate = new Date(targetYear, targetMonth, clampDay(targetYear, targetMonth, day));
  return dueDate.toISOString().slice(0, 10);
}

// Monta o texto da fatura (usado tanto para WhatsApp quanto como base do
// que aparece na impressão).
// Texto de reconhecimento de dívida que o cliente lê antes de digitar a
// senha. O texto exato fica salvo junto com a venda, servindo como registro
// do que foi apresentado e aceito no momento da compra.
export function buildAcknowledgmentText({ storeName, customerName, value, description, dueDate }) {
  const desc = description ? ` referente a "${description}"` : "";
  return `Eu, ${customerName}, confirmo o recebimento de produtos/serviços${desc} no valor de ${brl(value)}, junto a ${storeName || "o mercado"}, com vencimento em ${fmtDate(dueDate)}, e me comprometo a efetuar o pagamento integral até essa data.`;
}

export function buildInvoiceText({ storeName, customer, sales, total }) {
  const lines = [];
  const nextDue = sales.map((s) => s.dueDate).sort()[0];
  lines.push(`Olá, seguem os dados da sua conta no mercado ${storeName || "Mercado"} com vencimento em ${fmtDate(nextDue)}.`);
  lines.push("");
  lines.push(`Cliente: ${customer.name}`);
  lines.push("");
  lines.push("Compras:");
  sales.forEach((s) => {
    const desc = s.description ? ` (${s.description})` : "";
    lines.push(`- ${fmtDate(s.date)}: ${brl(s.value)}${desc}`);
  });
  lines.push("");
  lines.push(`*Total: ${brl(total)}*`);
  lines.push("");
  lines.push("Mensagem automática, desconsidere caso já tenha efetuado o pagamento.");
  return lines.join("\n");
}

export function whatsappLink(phoneDigits, text) {
  const digits = onlyDigits(phoneDigits);
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
}

export const PAYMENT_METHODS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "pix", label: "Pix" },
];

export function paymentMethodLabel(value) {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label || "";
}

// Linha de saldo usada nas mensagens de WhatsApp: mostra o crédito ainda
// disponível (se o cliente tiver limite definido) ou o saldo devedor atual.
export function buildBalanceLine(customer, owedAfter) {
  if (customer?.creditLimit) {
    const avail = customer.creditLimit - owedAfter;
    return `Saldo disponível: ${brl(avail)} (limite de ${brl(customer.creditLimit)})`;
  }
  return `Saldo devedor atual: ${brl(owedAfter)}`;
}

// Mensagem de WhatsApp enviada logo após uma compra ser confirmada.
export function buildPurchaseText({ storeName, customer, sale, owedAfter }) {
  const lines = [];
  lines.push(`Olá, aqui está o comprovante da sua compra no mercado ${storeName || "Mercado"}:`);
  lines.push("");
  lines.push(`Data: ${fmtDate(sale.date)}`);
  if (sale.description) lines.push(`Descrição: ${sale.description}`);
  lines.push(`Valor: ${brl(sale.value)}`);
  lines.push(`Vencimento: ${fmtDate(sale.dueDate)}`);
  lines.push("");
  lines.push(buildBalanceLine(customer, owedAfter));
  lines.push("");
  lines.push("Mensagem automática.");
  return lines.join("\n");
}

// Número legível do recibo, baseado em data e hora (sem depender de um
// contador compartilhado no banco).
export function generateReceiptNumber() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// Formata um Timestamp do Firestore (ou Date) como data e hora em pt-BR.
export function fmtTimestamp(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export function buildReceiptText({ storeName, receipt, customer, owedAfter }) {
  const lines = [];
  lines.push(`*Recibo de pagamento — ${storeName || "Mercado"}*`);
  lines.push(`Nº ${receipt.receiptNumber}`);
  lines.push(`Cliente: ${receipt.customerName}`);
  lines.push("");
  lines.push("Itens quitados:");
  receipt.items.forEach((it) => {
    const desc = it.description ? ` (${it.description})` : "";
    lines.push(`- ${fmtDate(it.date)}: ${brl(it.value)}${desc}`);
  });
  lines.push("");
  lines.push(`*Total pago: ${brl(receipt.total)}*`);
  if (receipt.paymentMethod) lines.push(`Forma de pagamento: ${paymentMethodLabel(receipt.paymentMethod)}`);
  lines.push(`Data do pagamento: ${fmtTimestamp(receipt.paidAt)}`);
  if (customer) {
    lines.push("");
    lines.push(buildBalanceLine(customer, owedAfter ?? 0));
  }
  lines.push("");
  lines.push("Mensagem automática.");
  return lines.join("\n");
}

import { CURATED_SUPPLIERS } from "./supplier-directory";

const ALLOWED_HOSTS = new Set(["robu.in", "www.robu.in", "electronicscomp.com", "www.electronicscomp.com", "in.element14.com", "element14.com", "www.mouser.in", "mouser.in", "www.digikey.in", "digikey.in", "www.indiamart.com", "indiamart.com", "dir.indiamart.com", "www.lcsc.com", "lcsc.com", "jlcpcb.com", "www.jlcpcb.com", "www.pcbway.com", "pcbway.com", "www.alibaba.com", "alibaba.com", "www.aliexpress.com", "aliexpress.com"]);

export function validatedSupplierUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname.toLowerCase()) ? url : null;
  } catch { return null; }
}

export function meaningfulSupplierSearchTerm(value: string) {
  const term = value.trim().replace(/\s+/g, " ").slice(0, 200);
  const meaningful = term.split(" ").filter((token) => token.replace(/[^a-z0-9]/gi, "").length >= 3);
  return meaningful.length >= 2 ? term : null;
}

export function supplierSearchLink(supplierId: string, searchTerm: string) {
  const supplier = CURATED_SUPPLIERS.find((item) => item.id === supplierId);
  const term = meaningfulSupplierSearchTerm(searchTerm);
  if (!supplier?.searchUrlTemplate || !term) return null;
  const candidate = supplier.searchUrlTemplate.replace("{query}", encodeURIComponent(term));
  return validatedSupplierUrl(candidate)?.toString() ?? null;
}

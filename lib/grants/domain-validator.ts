const ALLOWLIST = new Set(["cgtmse.in", "www.cgtmse.in", "sidbi.in", "www.sidbi.in", "sidbivcf.in", "www.sidbivcf.in", "startupindia.gov.in", "www.startupindia.gov.in", "seedfund.startupindia.gov.in", "birac.nic.in", "www.birac.nic.in", "nidhi.dst.gov.in", "aim.gov.in", "www.aim.gov.in", "msh.meity.gov.in", "tdb.gov.in", "www.tdb.gov.in", "ipindia.gov.in", "www.ipindia.gov.in"]);
const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "buff.ly"]);

export function validatedOfficialUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || SHORTENERS.has(host) || url.username || url.password) return null;
    if (host.endsWith(".gov.in") || host.endsWith(".nic.in") || host === "gov.in" || host === "nic.in" || ALLOWLIST.has(host)) return url;
    return null;
  } catch { return null; }
}

export function isOfficialGovernmentUrl(value: string) { return Boolean(validatedOfficialUrl(value)); }

type QueryResult<T = unknown> = { data: T; error: Error | null };

class Query<T = any> {
  private table: string;
  private operation: "select" | "insert" | "update" = "select";
  private payload: any;
  private filters: string[] = [];
  private orderBy?: string;
  private ascending = true;
  private wantSingle = false;

  constructor(table: string) { this.table = table; }
  select(_columns = "*") { this.operation = this.operation === "insert" || this.operation === "update" ? this.operation : "select"; return this; }
  insert(payload: any) { this.operation = "insert"; this.payload = payload; return this; }
  update(payload: any) { this.operation = "update"; this.payload = payload; return this; }
  eq(column: string, value: string) { this.filters.push(`${encodeURIComponent(column)}=eq.${encodeURIComponent(value)}`); return this; }
  order(column: string, opts?: { ascending?: boolean }) { this.orderBy = column; this.ascending = opts?.ascending ?? true; return this; }
  single() { this.wantSingle = true; return this.run(); }
  then<TResult1 = QueryResult<T>, TResult2 = never>(onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null) { return this.run().then(onfulfilled as any, onrejected as any); }
  private async run(): Promise<QueryResult<any>> {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return { data: null, error: new Error("Missing Supabase environment variables") };
    const base = `${url.replace(/\/$/, "")}/rest/v1/${this.table}`;
    const params = [...this.filters];
    if (this.orderBy) params.push(`order=${encodeURIComponent(this.orderBy)}.${this.ascending ? "asc" : "desc"}`);
    const query = params.length ? `?${params.join("&")}` : "";
    const headers: Record<string,string> = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    if (this.operation === "select") headers.Prefer = this.wantSingle ? "return=representation" : "return=representation";
    else headers.Prefer = "return=representation";
    try {
      const response = await fetch(base + query, { method: this.operation === "select" ? "GET" : this.operation === "insert" ? "POST" : "PATCH", headers, body: this.operation === "select" ? undefined : JSON.stringify(this.payload) });
      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      if (!response.ok) return { data: null, error: new Error(data?.message || data?.hint || "Supabase request failed") };
      if (this.wantSingle) return { data: Array.isArray(data) ? data[0] : data, error: null };
      return { data, error: null };
    } catch (error) { return { data: null, error: error instanceof Error ? error : new Error("Supabase request failed") }; }
  }
}

export function getSupabaseAdmin() {
  return { from: <T = any>(table: string) => new Query<T>(table) };
}
